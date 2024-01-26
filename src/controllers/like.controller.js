import mongoose, { isValidObjectId } from "mongoose";
import { Like } from "../models/like.model.js";
import { ApiError, ApiRes, asyncHandler } from "../utils/index.js";

/**
 * Toggles the like status for a video.
 * @param {Object} req - Express request object.
 * @param {Object} res - Express response object.
 * @returns {Promise<void>} - A Promise that resolves when the operation is complete.
 */
const toggleVideoLike = asyncHandler(async (req, res) => {
  const { videoId } = req.params;
  if (!isValidObjectId(videoId)) {
    throw new ApiError(400, "Invalid VideoId");
  }
  const deletedLike = await Like.findOneAndDelete({
    likedBy: req.user._id,
    video: videoId,
  });
  if (!deletedLike) {
    const like = await Like.create({
      video: videoId,
      likedBy: req.user._id,
    });
    if (!like) {
      throw new ApiError(500, "Error while creating like");
    }
  }
  return res
    .status(200)
    .json(new ApiRes(200, {}, "Successfully toggled like button"));
});

/**
 * Toggles the like status for a comment.
 * @param {Object} req - Express request object.
 * @param {Object} res - Express response object.
 * @returns {Promise<void>} - A Promise that resolves when the operation is complete.
 */
const toggleCommentLike = asyncHandler(async (req, res) => {
  const { commentId } = req.params;
  if (!isValidObjectId(commentId)) {
    throw new ApiError(400, "Invalid CommentId");
  }
  const deletedLike = await Like.findOneAndDelete({
    likedBy: req.user._id,
    comment: commentId,
  });
  if (!deletedLike) {
    const like = await Like.create({
      comment: commentId,
      likedBy: req.user._id,
    });
    if (!like) {
      throw new ApiError(500, "Error while creating like");
    }
  }

  return res
    .status(200)
    .json(new ApiRes(200, {}, "Successfully toggled like button"));
});

/**
 * Toggles the like status for a tweet.
 * @param {Object} req - Express request object.
 * @param {Object} res - Express response object.
 * @returns {Promise<void>} - A Promise that resolves when the operation is complete.
 */
const toggleTweetLike = asyncHandler(async (req, res) => {
  const { tweetId } = req.params;

  if (!isValidObjectId(tweetId)) {
    throw new ApiError(400, "Invalid TweetId");
  }
  const deletedLike = await Like.findOneAndDelete({
    likedBy: req.user._id,
    tweet: tweetId,
  });
  if (!deletedLike) {
    const like = await Like.create({
      tweet: tweetId,
      likedBy: req.user._id,
    });
    if (!like) {
      throw new ApiError(500, "Error while creating like");
    }
  }

  return res
    .status(200)
    .json(new ApiRes(200, {}, "Successfully toggled like button"));
});

/**
 * Retrieves videos liked by the user.
 * @param {Object} req - Express request object.
 * @param {Object} res - Express response object.
 * @returns {Promise<void>} - A Promise that resolves when the operation is complete.
 */
const getLikedVideos = asyncHandler(async (req, res) => {
  let videos = await Like.aggregate([
    {
      $match: {
        likedBy: req.user?._id,
        video: {
          $exists: true,
        },
      },
    },
    {
      $lookup: {
        from: "videos",
        localField: "video",
        foreignField: "_id",
        as: "videos",
        pipeline: [
          {
            $lookup: {
              from: "users",
              localField: "owner",
              foreignField: "_id",
              as: "owner",
              pipeline: [
                {
                  $project: {
                    username: 1,
                    fullName: 1,
                    avatar: 1,
                  },
                },
              ],
            },
          },
          {
            $addFields: {
              owner: {
                $first: "$owner",
              },
            },
          },
        ],
      },
    },
    {
      $group: {
        _id: null,
        videos: { $push: { $first: "$videos" } },
      },
    },
  ]);

  if (videos.length < 1) {
    throw new ApiError(400, "User has not liked any videos yet");
  }

  return res
    .status(200)
    .json(
      new ApiRes(200, videos[0].videos, "Liked videos fetched successfully")
    );
});

export { getLikedVideos, toggleCommentLike, toggleTweetLike, toggleVideoLike };
