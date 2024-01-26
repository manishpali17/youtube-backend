import mongoose, { isValidObjectId } from "mongoose";
import { Video } from "../models/video.model.js";
import { ApiError, ApiRes, asyncHandler } from "../utils/index.js";
import { Subscription } from "../models/subscription.model.js";
import { User } from "../models/user.model.js";

/**
 * Retrieves statistics for a user's channel.
 * @param {Object} req - Express request object.
 * @param {Object} res - Express response object.
 * @returns {Promise<void>} - A Promise that resolves when the operation is complete.
 */
const getChannelStats = asyncHandler(async (req, res) => {
  const { channelId } = req.params;

  if (!isValidObjectId(channelId)) {
    throw new ApiError(400, "Invaild ChannelId");
  }
  const channel = await User.findById(channelId);
  if (!channel) {
    throw new ApiError(400, "Channel not found");
  }
  const subscribersCount = await Subscription.countDocuments({
    channel: channelId,
  });
  const channelsSubscribedToCount = await Subscription.countDocuments({
    subscriber: channelId,
  });

  // Fetch video-related stats
  const videos = await Video.aggregate([
    {
      $match: {
        owner: channelId ? new mongoose.Types.ObjectId(channelId) : null,
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
      $group: {
        _id: null,
        totalVideos: { $sum: 1 },
        totalViews: { $sum: "$views" },
        totalLikes: { $sum: { $size: "$likes" } },
      },
    },
    {
      $project: {
        _id: 0,
        totalVideos: 1,
        totalViews: 1,
        totalLikes: 1,
      },
    },
  ]);

  const channelStats = {
    subscribersCount: subscribersCount || 0,
    channelsSubscribedToCount: channelsSubscribedToCount || 0,
    totalVideos: videos[0]?.totalVideos || 0,
    totalViews: videos[0]?.totalViews || 0,
    totalLikes: videos[0]?.totalLikes || 0,
  };

  return res
    .status(200)
    .json(new ApiRes(200, channelStats, "User stats fetched successfully"));
});

/**
 * Retrieves all videos from a specific channel.
 * @param {Object} req - Express request object.
 * @param {Object} res - Express response object.
 * @returns {Promise<void>} - A Promise that resolves when the operation is complete.
 */
const getChannelVideos = asyncHandler(async (req, res) => {
  const { channelId } = req.params;

  // Check if the provided channelId is a valid ObjectId
  if (!isValidObjectId(channelId)) {
    throw new ApiError(400, "Invalid ChannelId");
  }

  const channel = await User.findById(channelId);

  if (!channel) {
    throw new ApiError(404, "Channel not found");
  }

  // Fetch videos from the specified channel that are published
  const videos = await Video.find({
    owner: channelId,
    isPublished: true,
  }).populate(
    "owner",
    {
      videoFile: 1,
      thumbnail: 1,
      title: 1,
      description: 1,
      duration: 1,
      createdAt: 1,
      views: 1,
      username: 1,
      fullName: 1,
      avatar: 1,
    },
    "User"
  );

  // Check if videos were found
  if (!videos || videos.length === 0) {
    throw new ApiError(400, "No videos uploaded by the user");
  }

  // Return the fetched videos in the response
  return res
    .status(200)
    .json(new ApiRes(200, videos, "All videos fetched successfully"));
});

export { getChannelStats, getChannelVideos };
