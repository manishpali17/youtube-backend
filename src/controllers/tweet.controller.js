import { isValidObjectId } from "mongoose";
import { Tweet } from "../models/tweet.model.js";
import { User } from "../models/user.model.js";
import { ApiError, ApiRes, asyncHandler } from "../utils/index.js";

/**
 * Creates a new tweet.
 * @param {Object} req - Express request object.
 * @param {Object} res - Express response object.
 * @returns {Promise<void>} - A Promise that resolves when the operation is complete.
 */
const createTweet = asyncHandler(async (req, res) => {
  const { content } = req.body;
  if (!content) {
    throw new ApiError(400, "Please provide content to create a tweet");
  }
  const tweet = await Tweet.create({
    content,
    owner: req.user?._id,
  });
  if (!tweet) {
    throw new ApiError(500, "Error while creating the tweet");
  }
  return res
    .status(200)
    .json(new ApiRes(201, tweet, "Successfully created a tweet"));
});

/**
 * Retrieves tweets of a specific user.
 * @param {Object} req - Express request object.
 * @param {Object} res - Express response object.
 * @returns {Promise<void>} - A Promise that resolves when the operation is complete.
 */
const getUserTweets = asyncHandler(async (req, res) => {
  const { userId } = req.params;

  if (!isValidObjectId(userId)) throw new ApiError(400, "Invalid UserId");

  const user = await User.findById(userId);

  if (!user) {
    throw new ApiError(400, "User not found");
  }
  const tweets = await Tweet.aggregate([
    {
      $match: {
        owner: user ? user._id : null,
      },
    },
    {
      $lookup: {
        from: "likes",
        localField: "_id",
        foreignField: "tweet",
        as: "likes",
        pipeline: [
          {
            // this pipeline for getting profile of users who liked the tweet
            $lookup: {
              from: "users",
              localField: "likedBy",
              foreignField: "_id",
              as: "users",
              pipeline: [
                {
                  $project: {
                    _id: 0,
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
                $first: "$users",
              },
            },
          },
          {
            $project: {
              owner: 1,
            },
          },
        ],
      },
    },
    {
      $addFields: {
        totalLikes: {
          $size: "$likes",
        },
      },
    },
  ]);
  if (tweets.length < 1) {
    throw new ApiError(400, "No tweets by the user yet");
  }
  return res
    .status(200)
    .json(new ApiRes(200, tweets, "Tweets fetched successfully"));
});

/**
 * Updates the content of a tweet.
 * @param {Object} req - Express request object.
 * @param {Object} res - Express response object.
 * @returns {Promise<void>} - A Promise that resolves when the operation is complete.
 */
const updateTweet = asyncHandler(async (req, res) => {
  const { content } = req.body;
  const { tweetId } = req.params;
  if (!isValidObjectId(tweetId)) {
    throw new ApiError(400, "Invalid tweetId");
  }
  if (!content) {
    throw new ApiError(400, "Please provide content to update the tweet");
  }
  const tweet = await Tweet.findOneAndUpdate(
    {
      _id: tweetId,
      owner: req.user?._id,
    },
    {
      $set: {
        content,
      },
    },
    {
      new: true,
    }
  );
  if (!tweet) {
    throw new ApiError(500, "Error while updating the tweet");
  }
  return res
    .status(200)
    .json(new ApiRes(201, tweet, "Successfully updated the tweet"));
});

/**
 * Deletes a tweet.
 * @param {Object} req - Express request object.
 * @param {Object} res - Express response object.
 * @returns {Promise<void>} - A Promise that resolves when the operation is complete.
 */
const deleteTweet = asyncHandler(async (req, res) => {
  const { tweetId } = req.params;
  if (!isValidObjectId(tweetId)) {
    throw new ApiError(400, "Invalid tweetId");
  }
  const deletedTweet = await Tweet.findOneAndDelete({
    _id: tweetId,
    owner: req.user?._id,
  });
  if (!deletedTweet) {
    throw new ApiError(
      400,
      "You are not the owner of the tweet or the tweet is not found"
    );
  }
  return res
    .status(200)
    .json(new ApiRes(201, {}, "Successfully deleted the tweet"));
});

export { createTweet, deleteTweet, getUserTweets, updateTweet };
