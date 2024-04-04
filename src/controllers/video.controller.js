import mongoose, { isValidObjectId } from "mongoose";
import { User } from "../models/user.model.js";
import { Video } from "../models/video.model.js";
import jwt from "jsonwebtoken";
import {
  ApiError,
  ApiRes,
  asyncHandler,
  deleteOnCloudinary,
  uploadOnCloudinary,
} from "../utils/index.js";

/**
 * Retrieves a paginated list of videos based on specified filters.
 * @param {Object} req - Express request object.
 * @param {Object} res - Express response object.
 * @returns {Promise<void>} - A Promise that resolves when the operation is complete.
 */
const getAllVideos = asyncHandler(async (req, res) => {
  const {
    userId,
    query,
    sortBy = "createdAt",
    sortType = "asc",
    page = 1,
    limit = 10,
  } = req.query;

  const sortByField = ["createdAt", "duration", "views"];
  const sortTypeArr = ["asc", "dsc"];

  if (!sortByField.includes(sortBy) || !sortTypeArr.includes(sortType)) {
    throw new ApiError(400, "Please send valid fields for sortBy or sortType");
  }
  if (userId && !isValidObjectId(userId)) {
    throw new ApiError(400, "Invalid userId");
  }
  const video = Video.aggregate([
    {
      $match: {
        $or: [
          {
            owner: userId ? new mongoose.Types.ObjectId(userId) : null,
          },
          {
            $and: [
              { isPublished: true },
              {
                $or: [
                  {
                    title: query
                      ? { $regex: query, $options: "i" }
                      : { $exists: true },
                  },
                  {
                    description: query
                      ? { $regex: query, $options: "i" }
                      : null,
                  },
                ],
              },
            ],
          },
        ],
      },
    },
    {
      $lookup: {
        from: "users",
        localField: "owner",
        foreignField: "_id",
        as: "owner",
        pipeline: [
          {
            $project: {
              fullName: 1,
              username: 1,
              avatar: 1,
            },
          },
        ],
      },
    },
    {
      $sort: {
        [sortBy]: sortType === "dsc" ? -1 : 1,
      },
    },
    {
      $addFields: {
        owner: {
          $first: "$owner",
        },
      },
    },
  ]);

  const result = await Video.aggregatePaginate(video, {
    page,
    limit,
    customLabels: {
      totalDocs: "totalVideos",
      docs: "Videos",
    },
    allowDiskUse: true,
  });

  if (result.totalVideos === 0) {
    throw new ApiError(404, "Videos not found");
  }

  return res
    .status(200)
    .json(new ApiRes(200, result, "Videos fetched successfully"));
});

/**
 * Publishes a new video.
 * @param {Object} req - Express request object.
 * @param {Object} res - Express response object.
 * @returns {Promise<void>} - A Promise that resolves when the operation is complete.
 */
const publishAVideo = asyncHandler(async (req, res) => {
  const {
    title,
    description,
    isPublished = true,
    categories = "",
    tags = "",
  } = req.body;

  if (!title || !description)
    throw new ApiError(400, "All fields are required");

  if (categories.length > 0) {
    const isValidCategory = [
      "Autos & Vehicles",
      "Comedy",
      "Education",
      "Entertainment",
      "Film & Animation",
      "Gaming",
      "Howto & Style",
      "Music",
      "News & Politics",
      "Nonprofits & Activism",
      "People & Blogs",
      "Pets & Animals",
      "Science & Technology",
      "Sports",
      "Travel & Events",
    ].includes(categories);

    if (!isValidCategory) {
      throw new ApiError(400, "Invalid category provided");
    }
  }

  let tagsArray = [];
  if (tags.includes(",")) {
    tagsArray = tags.split(",").map((tag) => tag.trim());
  }

  const videoLocalPath = req.files?.videoFile[0]?.path;
  const thumbnailLocalPath = req.files?.thumbnail[0]?.path;

  if (!(videoLocalPath && thumbnailLocalPath)) {
    throw new ApiError(400, "Video file and avatar image required");
  }

  // Uploading on Cloudinary
  const videoFile = await uploadOnCloudinary(videoLocalPath);
  const thumbnail = await uploadOnCloudinary(thumbnailLocalPath);

  if (!videoFile || !thumbnail) {
    throw new ApiError(500, "Error occurred while uploading files");
  }

  const video = await Video.create({
    title,
    description,
    duration: videoFile.duration,
    videoFile: {
      url: videoFile.url,
      fileName: videoFile.public_id,
    },
    thumbnail: {
      url: thumbnail.url,
      fileName: thumbnail.public_id,
    },
    owner: req.user?._id,
    isPublished: isPublished,
    categories: categories,
    tags: tagsArray,
  });

  if (!video) {
    throw new ApiError(500, "Error occurred while creating video");
  }
  return res
    .status(200)
    .json(new ApiRes(201, video, "Video uploaded successfully"));
});

/**
 * Retrieves a video by its ID, increments the view count, and returns detailed information.
 * @param {Object} req - Express request object.
 * @param {Object} res - Express response object.
 * @returns {Promise<void>} - A Promise that resolves when the operation is complete.
 */
const getVideoById = asyncHandler(async (req, res) => {
  const { videoId } = req.params;
  if (!isValidObjectId(videoId)) {
    throw new ApiError(400, "Invalid VideoId");
  }
let userId;
  try {
    const token =
      req.signedCookies?.accessToken ||
      req.header("Authorization")?.replace("Bearer ", "");
    const decodedToken = jwt.verify(token, process.env.ACCESS_TOKEN_SECRET);
    if (decodedToken) {
      const user = await User.findByIdAndUpdate(decodedToken?._id, {
        $addToSet: {
          watchHistory: videoId,
        },
      });
      userId = user._id
    }
  } catch (error) {
    console.log(error);
  }

  const updatedVideo = await Video.findByIdAndUpdate(videoId, {
    $inc: { views: 1 },
  });

  if (!updatedVideo) {
    throw new ApiError(400, "Video not found");
  }

  const video = await Video.aggregate([
    {
      $match: {
        _id: videoId ? new mongoose.Types.ObjectId(videoId) : null,
      },
    },
    {
      $lookup: {
        from: "likes",
        localField: "_id",
        foreignField: "video",
        as: "likes",
      },
    },
    {
      $lookup: {
        from: "users",
        localField: "owner",
        foreignField: "_id",
        as: "owner",
        pipeline: [
          {
            $lookup: {
              from: "subscriptions",
              localField: "_id",
              foreignField: "channel",
              as: "subscribers",
            },
          },
          {
            $addFields: {
              subscribersCount: {
                $size: "$subscribers",
              },
              isSubscribed: {
                $cond: {
                  if: {
                    $in: [userId, "$subscribers.subscriber"],
                  },
                  then: true,
                  else: false,
                },
              },
            },
          },
          {
            $project: {
              fullName: 1,
              username: 1,
              avatar: 1,
              subscribersCount: 1,
              isSubscribed: 1,
            },
          },
        ],
      },
    },
    {
      $addFields: {
        likesOnVideo: {
          $size: "$likes",
        },
        owner: {
          $first: "$owner",
        },
        isLiked: {
          $cond: {
            if: { $in: [userId, "$likes.likedBy"] },
            then: true,
            else: false,
          },
        },
      },
    },
    {
      $project: {
        likes: 0,
      },
    },
  ]);

  if (video.length < 1) {
    throw new ApiError(404, "Video not found");
  }

  return res
    .status(200)
    .json(new ApiRes(200, video[0], "Video fetched successfully"));
});

/**
 * Updates the details of a video, including title, description, and thumbnail.
 * @param {Object} req - Express request object.
 * @param {Object} res - Express response object.
 * @returns {Promise<void>} - A Promise that resolves when the operation is complete.
 */
const updateVideo = asyncHandler(async (req, res) => {
  const { videoId } = req.params;
  const { title, description, categories = "", tags = "" } = req.body;
  const thumbnailLocalPath = req.file?.path;

  if (!isValidObjectId(videoId)) {
    throw new ApiError(400, "Invalid ID");
  }
  if (!title || !description) {
    throw new ApiError(400, "Title and description required");
  }
  if (categories.length > 0) {
    const isValidCategory = [
      "Autos & Vehicles",
      "Comedy",
      "Education",
      "Entertainment",
      "Film & Animation",
      "Gaming",
      "Howto & Style",
      "Music",
      "News & Politics",
      "Nonprofits & Activism",
      "People & Blogs",
      "Pets & Animals",
      "Science & Technology",
      "Sports",
      "Travel & Events",
    ].includes(categories);

    if (!isValidCategory) {
      throw new ApiError(400, "Invalid category provided");
    }
  }

  let tagsArray = [];
  if (tags.includes(",")) {
    tagsArray = tags.split(",").map((tag) => tag.trim());
  }

  if (thumbnailLocalPath && thumbnailLocalPath !== "undefined") {
    const thumbnail = await uploadOnCloudinary(thumbnailLocalPath);

    if (!thumbnail) {
      throw new ApiError(500, "Error occurred while uploading on Cloudinary");
    }
    const video = await Video.findOneAndUpdate(
      { _id: videoId, owner: req.user._id },
      {
        $set: {
          title,
          description,
          thumbnail: {
            fileName: thumbnail.public_id,
            url: thumbnail.url,
          },
          tags,
          categories,
        },
      }
    );

    if (!video) {
      throw new ApiError(
        400,
        "Video not found or you are not the owner of this video"
      );
    }

    const oldThumbnailDeletedRes = await deleteOnCloudinary(
      video.thumbnail.fileName
    );

    if (oldThumbnailDeletedRes.error) {
      throw new ApiError(500, "Error while deleting on Cloudinary");
    }
    const updatedVideo = await Video.findById(video._id);

    return res
      .status(200)
      .json(new ApiRes(200, updatedVideo, "Video successfully updated"));
  } else {
    const video = await Video.findOneAndUpdate(
      {
        _id: videoId,
        owner: req.user._id,
      },
      {
        $set: {
          title,
          description,
          tags,
          categories,
        },
      },
      { new: true }
    );

    if (!video) {
      throw new ApiError(
        400,
        "Video not found or you are not the owner of this video"
      );
    }

    return res
      .status(200)
      .json(
        new ApiRes(200, video, "Title and description updated successfully")
      );
  }
});

/**
 * Deletes a video and its associated files from Cloudinary.
 * @param {Object} req - Express request object.
 * @param {Object} res - Express response object.
 * @returns {Promise<void>} - A Promise that resolves when the operation is complete.
 */
const deleteVideo = asyncHandler(async (req, res) => {
  const { videoId } = req.params;

  if (!isValidObjectId(videoId)) {
    throw new ApiError(400, "Invalid VideoID");
  }
  const video = await Video.findOneAndDelete({
    _id: videoId,
    owner: req.user._id,
  });

  if (!video) {
    throw new ApiError(
      400,
      "Video not found or you are not the owner of this video"
    );
  }

  return res
    .status(200)
    .json(new ApiRes(200, {}, "Video deleted successfully"));
});

/**
 * Toggles the publish status of a video.
 * @param {Object} req - Express request object.
 * @param {Object} res - Express response object.
 * @returns {Promise<void>} - A Promise that resolves when the operation is complete.
 */
const togglePublishStatus = asyncHandler(async (req, res) => {
  const { videoId } = req.params;

  if (!isValidObjectId(videoId)) throw new ApiError(400, "Invalid videoId");

  const video = await Video.findOne({
    _id: videoId,
    owner: req.user._id,
  });

  if (!video) {
    throw new ApiError(400, "Video not found or you are not the owner");
  }

  // Toggle the isPublished field
  video.isPublished = !video.isPublished;

  // Save the updated video
  const updatedVideo = await video.save({ validateBeforeSave: false });

  return res
    .status(200)
    .json(
      new ApiRes(
        200,
        {},
        `Video successfully ${
          updatedVideo.isPublished ? "Published" : "Unpublished"
        }`
      )
    );
});

export {
  deleteVideo,
  getAllVideos,
  getVideoById,
  publishAVideo,
  togglePublishStatus,
  updateVideo,
};
