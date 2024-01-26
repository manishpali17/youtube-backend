import mongoose, { isValidObjectId } from "mongoose";
import { Comment } from "../models/comment.model.js";
import { Video } from "../models/video.model.js";
import { ApiError, ApiRes, asyncHandler } from "../utils/index.js";

/**
 * Retrieves all comments for a specific video.
 * @param {Object} req - Express request object.
 * @param {Object} res - Express response object.
 * @returns {Promise<void>} - A Promise that resolves when the operation is complete.
 */
const getVideoComments = asyncHandler(async (req, res) => {
  const { videoId } = req.params;
  const { page = 1, limit = 10 } = req.query;

  if (!isValidObjectId(videoId)) {
    throw new ApiError(400, "Invalid VideoId");
  }

  const aggregateComment = Comment.aggregate([
    {
      $match: {
        video: videoId ? new mongoose.Types.ObjectId(videoId) : null,
      },
    },
    {
      $lookup: {
        from: "likes",
        localField: "_id",
        foreignField: "comment",
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
      $addFields: {
        likesOnComment: {
          $size: "$likes",
        },
        owner: {
          $first: "$owner",
        },
        isLiked: {
          $cond: {
            if: { $in: [req.user?._id, "$likes.likedBy"] },
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

  const comment = await Comment.aggregatePaginate(aggregateComment, {
    page,
    limit,
    customLabels: {
      totalDocs: "totalComments",
      docs: "comments",
    },
  });

  if (comment.docs === 0) {
    throw new ApiError(404, "Video not found or no comments on the video yet");
  }

  return res
    .status(200)
    .json(new ApiRes(200, comment, "All comments are fetched"));
});

/**
 * Adds a new comment to a video.
 * @param {Object} req - Express request object.
 * @param {Object} res - Express response object.
 * @returns {Promise<void>} - A Promise that resolves when the operation is complete.
 */
const addComment = asyncHandler(async (req, res) => {
  const { content } = req.body;
  const { videoId } = req.params;

  if (!content) {
    throw new ApiError(400, "Content is required to make a comment");
  }

  if (!isValidObjectId(videoId)) {
    throw new ApiError(400, "Invalid VideoId");
  }

  const video = await Video.findById(videoId);

  if (!video) {
    throw new ApiError(400, "The video was not found");
  }

  const commentCreated = await Comment.create({
    content,
    owner: req.user._id,
    video: video._id,
  });

  const comment = await Comment.findById(commentCreated._id);

  if (!comment) {
    throw new ApiError(500, "Failed to add a comment, please try again");
  }

  return res
    .status(201)
    .json(new ApiRes(201, comment, "Comment added successfully"));
});

/**
 * Updates an existing comment.
 * @param {Object} req - Express request object.
 * @param {Object} res - Express response object.
 * @returns {Promise<void>} - A Promise that resolves when the operation is complete.
 */
const updateComment = asyncHandler(async (req, res) => {
  const { commentId } = req.params;
  const { content } = req.body;

  if (!isValidObjectId(commentId) || !content) {
    throw new ApiError(400, "Invalid CommentId or Content required");
  }

  const comment = await Comment.findOneAndUpdate(
    {
      _id: commentId,
      owner: req.user._id,
    },
    {
      $set: {
        content,
      },
    },
    { new: true }
  );

  if (!comment) {
    throw new ApiError(
      400,
      "Comment not found or you are not the owner of the comment"
    );
  }

  return res
    .status(200)
    .json(new ApiRes(200, comment, "Comment edited successfully"));
});

/**
 * Deletes an existing comment.
 * @param {Object} req - Express request object.
 * @param {Object} res - Express response object.
 * @returns {Promise<void>} - A Promise that resolves when the operation is complete.
 */
const deleteComment = asyncHandler(async (req, res) => {
  const { commentId } = req.params;

  if (!isValidObjectId(commentId)) {
    throw new ApiError(400, "Invalid CommentId");
  }

  const deletedComment = await Comment.findOneAndDelete({
    _id: commentId,
    owner: req.user._id,
  });

  if (!deletedComment) {
    throw new ApiError(
      400,
      "Comment not found or you are not the owner of the comment"
    );
  }

  return res
    .status(200)
    .json(new ApiRes(200, {}, "Successfully deleted the comment"));
});

export { addComment, deleteComment, getVideoComments, updateComment };
