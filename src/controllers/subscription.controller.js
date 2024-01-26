import mongoose, { isValidObjectId } from "mongoose";
import { Subscription } from "../models/subscription.model.js";
import { User } from "../models/user.model.js";
import { ApiError, ApiRes, asyncHandler } from "../utils/index.js";

/**
 * Toggles user subscription to a channel.
 * @param {Object} req - Express request object.
 * @param {Object} res - Express response object.
 * @returns {Promise<void>} - A Promise that resolves when the operation is complete.
 */
const toggleSubscription = asyncHandler(async (req, res) => {
  const { channelId } = req.params;
  if (!isValidObjectId(channelId)) {
    throw new ApiError(400, "Invalid ChannelId");
  }
  if (req.user?._id === new mongoose.Types.ObjectId(channelId)) {
    throw new ApiError(400, "you can not subscribe yourself");
  }
  const unsubscribe = await Subscription.findOneAndDelete({
    channel: channelId,
    subscriber: req.user._id,
  });

  if (!unsubscribe) {
    const subscribe = await Subscription.create({
      channel: channelId,
      subscriber: req.user._id,
    });
    if (!subscribe) {
      throw new ApiError(500, "Error while subscribing");
    }
  }
  return res
    .status(200)
    .json(new ApiRes(201, "Successfully toggled subscription"));
});

/**
 * Retrieves the list of subscribers for a channel.
 * @param {Object} req - Express request object.
 * @param {Object} res - Express response object.
 * @returns {Promise<void>} - A Promise that resolves when the operation is complete.
 */
const getUserChannelSubscribers = asyncHandler(async (req, res) => {
  const { channelId } = req.params;
  if (!isValidObjectId(channelId)) {
    throw new ApiError(400, "Invalid ChannelId");
  }

  const subscribers = await Subscription.aggregate([
    {
      $match: {
        channel: channelId ? new mongoose.Types.ObjectId(channelId) : null,
      },
    },
    {
      $lookup: {
        from: "users",
        localField: "subscriber",
        foreignField: "_id",
        as: "subscribers",
        pipeline: [
          {
            $project: {
              username: 1,
              fullName: 1,
              avatar: 1,
              createdAt: 1,
            },
          },
        ],
      },
    },
    {
      $addFields: {
        subscribersCount: {
          $size: "$subscribers",
        },
        isSubscribed: {
          $cond: {
            if: { $in: [req.user?._id, "$subscribers.subscriber"] },
            then: true,
            else: false,
          },
        },
      },
    },
    {
      $project: {
        _id: 0,
        subscribers: 1,
        subscribersCount: 1,
        isSubscribed: 1,
      },
    },
  ]);
  if (subscribers.length < 1) {
    throw new ApiError(404, "Channel has no subscribers yet");
  }

  return res
    .status(200)
    .json(
      new ApiRes(
        200,
        subscribers[0].subscribers,
        "Channel subscribers fetched successfully"
      )
    );
});

/**
 * Retrieves the list of channels subscribed to by a user.
 * @param {Object} req - Express request object.
 * @param {Object} res - Express response object.
 * @returns {Promise<void>} - A Promise that resolves when the operation is complete.
 */
const getSubscribedChannels = asyncHandler(async (req, res) => {
  const subscriberId = req.params.subscriberId;

  if (!isValidObjectId(subscriberId)) {
    throw new ApiError(400, "Invalid subscriberId");
  }
  const channels = await Subscription.aggregate([
    {
      $match: {
        subscriber: subscriberId
          ? new mongoose.Types.ObjectId(subscriberId)
          : null,
      },
    },
    {
      $lookup: {
        from: "users",
        localField: "channel",
        foreignField: "_id",
        as: "channel",
        pipeline: [
          {
            $project: {
              username: 1,
              fullName: 1,
              avatar: 1,
              createdAt: 1,
            },
          },
        ],
      },
    },
    {
      $project: {
        _id: 0,
        subscribedTo: "$channel",
      },
    },
  ]);
  if (!channels?.length) {
    throw new ApiError(404, "channel does not exists");
  }

  return res
    .status(200)
    .json(
      new ApiRes(
        200,
        channels[0].subscribedTo,
        "User channels fetched successfully"
      )
    );
});

export { getSubscribedChannels, getUserChannelSubscribers, toggleSubscription };
