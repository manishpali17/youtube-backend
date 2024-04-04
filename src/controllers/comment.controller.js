import mongoose, { isValidObjectId } from "mongoose";
import { Comment } from "../models/comment.model.js";
import { Video } from "../models/video.model.js";
import { ApiError, ApiRes, asyncHandler } from "../utils/index.js";
import { User } from "../models/user.model.js";
import jwt from "jsonwebtoken";

/**
 * Retrieves all comments for a specific video.
 * @param {Object} req - Express request object.
 * @param {Object} res - Express response object.
 * @returns {Promise<void>} - A Promise that resolves when the operation is complete.
 */

const getVideoComments = asyncHandler(async (req, res) => {
  const { videoId } = req.params;
  const { page = 1, limit = 10, sortType = "asc" } = req.query;

  const sortTypeArr = ["asc", "dsc"];

  if (!sortTypeArr.includes(sortType)) {
    throw new ApiError(400, "Please send valid fields for sortType");
  }

  if (!mongoose.isValidObjectId(videoId)) {
    throw new ApiError(400, "Invalid VideoId");
  }

  let userID;
  try {
    const token =
      req.signedCookies?.accessToken ||
      req.header("Authorization")?.replace("Bearer ", "");
    const decodedToken = jwt.verify(token, process.env.ACCESS_TOKEN_SECRET);
    if (decodedToken) {
      const user = await User.findById(decodedToken?._id);
      userID = user._id;
    }
  } catch (error) {
    console.log(error);
  }

  const aggregateComment = Comment.aggregate([
    {
      $match: {
        video: videoId ? new mongoose.Types.ObjectId(videoId) : null,
        parentComment: { $exists: false },
      },
    },
    {
      $lookup: {
        from: "comments",
        let: { mainCommentId: "$_id" },
        pipeline: [
          {
            $match: {
              $expr: { $eq: ["$parentComment", "$$mainCommentId"] },
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
              likesOnComment: { $size: "$likes" },
              owner: { $first: "$owner" },
              isLiked: {
                $cond: {
                  if: { $in: [userID, "$likes.likedBy"] },
                  then: true,
                  else: false,
                },
              },
            },
          },
          {
            $project: {
              _id: 1,
              content: 1,
              owner: 1,
              createdAt: 1,
              updatedAt: 1,
              likesOnComment: 1,
              isLiked: 1,
            },
          },
        ],
        as: "replies",
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
      },
    },

    {
      $addFields: {
        owner: { $arrayElemAt: ["$owner", 0] },
        likesOnComment: { $size: "$likes" },
        isLiked: {
          $cond: {
            if: { $in: [userID, "$likes.likedBy"] },
            then: true,
            else: false,
          },
        },
      },
    },
    {
      $project: {
        _id: 1,
        content: 1,
        owner: {
          _id: 1,
          username: 1,
          fullName: 1,
          avatar: 1,
        },
        createdAt: 1,
        updatedAt: 1,
        likesOnComment: 1,
        replies: 1,
        isLiked: 1,
      },
    },
    {
      $sort: {
        createdAt: sortType === "dsc" ? -1 : 1,
      },
    },
  ]);

  const comments = await Comment.aggregatePaginate(aggregateComment, {
    page,
    limit,
    customLabels: {
      totalDocs: "totalComments",
      docs: "comments",
    },
  });

  if (comments.totalComments === 0) {
    throw new ApiError(404, "Video not found or no comments on the video yet");
  }

  return res
    .status(200)
    .json(new ApiRes(200, comments, "All comments are fetched"));
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

const addReplyToComment = asyncHandler(async (req, res) => {
  const { parentCommentId } = req.params;
  const { content } = req.body;

  if (!content || !parentCommentId || !isValidObjectId(parentCommentId)) {
    throw new ApiError(400, "Invalid parentCommentId or content required");
  }

  const parentComment = await Comment.findById(parentCommentId);

  if (!parentComment) {
    throw new ApiError(404, "Parent comment not found");
  }

  const reply = new Comment({
    content,
    video: parentComment.video,
    owner: req.user._id,
    parentComment: parentCommentId,
  });
  await reply.save();

  parentComment.replies.push(reply._id);
  await parentComment.save();
  return res
    .status(201)
    .json(new ApiRes(201, reply, "Reply added successfully"));
});
/**
 * Updates an existing reply.
 * @param {Object} req - Express request object.
 * @param {Object} res - Express response object.
 * @returns {Promise<void>} - A Promise that resolves when the operation is complete.
 */
const updateReply = asyncHandler(async (req, res) => {
  const { replyId } = req.params;
  const { content } = req.body;

  if (!isValidObjectId(replyId) || !content) {
    throw new ApiError(400, "Invalid ReplyId or Content required");
  }

  const reply = await Comment.findOneAndUpdate(
    {
      _id: replyId,
      owner: req.user._id,
    },
    {
      $set: {
        content,
      },
    },
    { new: true }
  );

  if (!reply) {
    throw new ApiError(
      400,
      "Reply not found or you are not the owner of the reply"
    );
  }

  return res
    .status(200)
    .json(new ApiRes(200, reply, "Reply edited successfully"));
});

/**
 * Deletes an existing reply.
 * @param {Object} req - Express request object.
 * @param {Object} res - Express response object.
 * @returns {Promise<void>} - A Promise that resolves when the operation is complete.
 */
const deleteReply = asyncHandler(async (req, res) => {
  const { replyId } = req.params;

  if (!isValidObjectId(replyId)) {
    throw new ApiError(400, "Invalid ReplyId");
  }

  const deletedReply = await Comment.findOneAndDelete({
    _id: replyId,
    owner: req.user._id,
  });

  if (!deletedReply) {
    throw new ApiError(
      400,
      "Reply not found or you are not the owner of the reply"
    );
  }

  // Also remove the reply from its parent comment's replies array
  const parentComment = await Comment.findById(deletedReply.parentComment);
  if (parentComment) {
    parentComment.replies.pull(deletedReply._id);
    await parentComment.save();
  }

  return res
    .status(200)
    .json(new ApiRes(200, {}, "Successfully deleted the reply"));
});

export {
  addComment,
  deleteComment,
  getVideoComments,
  updateComment,
  addReplyToComment,
  updateReply,
  deleteReply,
};
