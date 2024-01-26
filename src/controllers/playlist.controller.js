import { isValidObjectId } from "mongoose";
import { Playlist } from "../models/playlist.model.js";
import { ApiError, ApiRes, asyncHandler } from "../utils/index.js";

/**
 * Creates a new playlist.
 * @param {Object} req - Express request object.
 * @param {Object} res - Express response object.
 * @returns {Promise<void>} - A Promise that resolves when the operation is complete.
 */
const createPlaylist = asyncHandler(async (req, res) => {
  const { name, description } = req.body;
  if (!name || !description) {
    throw new ApiError(400, "Name and description are required");
  }
  const playlist = await Playlist.create({
    name,
    description,
    owner: req.user?._id,
  });
  if (!playlist) {
    throw new ApiError(500, "Error while creating playlist");
  }
  return res
    .status(200)
    .json(new ApiRes(201, playlist, "Playlist created successfully"));
});

/**
 * Retrieves playlists owned by a user.
 * @param {Object} req - Express request object.
 * @param {Object} res - Express response object.
 * @returns {Promise<void>} - A Promise that resolves when the operation is complete.
 */
const getUserPlaylists = asyncHandler(async (req, res) => {
  const { userId } = req.params;

  if (!isValidObjectId(userId)) {
    throw new ApiError(400, "Invalid UserId");
  }
  const playlists = await Playlist.find({
    owner: userId ? userId : null,
  }).populate({
    path: "videos",
    populate: { path: "owner", select: "username fullName avatar" },
  });
  if (!playlists) {
    throw new ApiError(400, "No playlists found for the user");
  }
  return res
    .status(200)
    .json(new ApiRes(200, playlists, "Playlists successfully fetched"));
});

/**
 * Retrieves a playlist by its ID.
 * @param {Object} req - Express request object.
 * @param {Object} res - Express response object.
 * @returns {Promise<void>} - A Promise that resolves when the operation is complete.
 */
const getPlaylistById = asyncHandler(async (req, res) => {
  const { playlistId } = req.params;
  if (!isValidObjectId(playlistId)) {
    throw new ApiError(400, "Invalid PlaylistId");
  }
  const playlist = await Playlist.findOne({ _id: playlistId }).populate({
    path: "videos",
    populate: { path: "owner", select: "username fullName avatar" },
  });
  if (!playlist) {
    throw new ApiError(404, "Playlist not found");
  }
  return res
    .status(200)
    .json(new ApiRes(200, playlist, "Playlist fetched successfully"));
});

/**
 * Adds a video to a playlist.
 * @param {Object} req - Express request object.
 * @param {Object} res - Express response object.
 * @returns {Promise<void>} - A Promise that resolves when the operation is complete.
 */
const addVideoToPlaylist = asyncHandler(async (req, res) => {
  const { playlistId, videoId } = req.params;
  if (!isValidObjectId(playlistId) || !isValidObjectId(videoId)) {
    throw new ApiError(400, "Invalid Id");
  }
  const playlist = await Playlist.findOneAndUpdate(
    {
      _id: playlistId,
      owner: req.user._id,
    },
    {
      $addToSet: {
        videos: videoId,
      },
    },
    { new: true }
  );
  if (!playlist) {
    throw new ApiError(500, "Error while adding to playlist");
  }
  return res
    .status(200)
    .json(new ApiRes(200, playlist, "Successfully added to the playlist"));
});

/**
 * Removes a video from a playlist.
 * @param {Object} req - Express request object.
 * @param {Object} res - Express response object.
 * @returns {Promise<void>} - A Promise that resolves when the operation is complete.
 */
const removeVideoFromPlaylist = asyncHandler(async (req, res) => {
  const { playlistId, videoId } = req.params;
  if (!isValidObjectId(playlistId) || !isValidObjectId(videoId)) {
    throw new ApiError(400, "Invalid Id");
  }
  const playlist = await Playlist.findOneAndUpdate(
    {
      _id: playlistId,
      owner: req.user._id,
    },
    {
      $pull: {
        videos: videoId,
      },
    },
    { new: true }
  );
  if (!playlist) {
    throw new ApiError(500, "Failed to remove video from playlist");
  }
  return res
    .status(200)
    .json(new ApiRes(200, playlist, "Successfully removed from playlist"));
});

/**
 * Deletes a playlist.
 * @param {Object} req - Express request object.
 * @param {Object} res - Express response object.
 * @returns {Promise<void>} - A Promise that resolves when the operation is complete.
 */
const deletePlaylist = asyncHandler(async (req, res) => {
  const { playlistId } = req.params;
  if (!isValidObjectId(playlistId)) {
    throw new ApiError(400, "Invalid PlaylistId");
  }
  const deletedPlaylist = await Playlist.findOneAndDelete({
    _id: playlistId,
    owner: req.user?._id,
  });
  if (!deletedPlaylist) {
    throw new ApiError(500, "Unable to delete, please try later");
  }
  return res.status(200).json(new ApiRes(200, {}, "Deleted successfully"));
});

/**
 * Updates a playlist's name and description.
 * @param {Object} req - Express request object.
 * @param {Object} res - Express response object.
 * @returns {Promise<void>} - A Promise that resolves when the operation is complete.
 */
const updatePlaylist = asyncHandler(async (req, res) => {
  const { playlistId } = req.params;
  const { name, description } = req.body;
  if (!isValidObjectId(playlistId)) {
    throw new ApiError(400, "Invalid PlaylistId");
  }
  if (!name || !description) {
    throw new ApiError(400, "Name or description missing");
  }
  const playlist = await Playlist.findOneAndUpdate(
    {
      _id: playlistId,
      owner: req.user?._id,
    },
    {
      $set: {
        name,
        description,
      },
    },
    {
      new: true,
    }
  );
  if (!playlist) {
    throw new ApiError(
      400,
      "You are not the owner of the playlist or playlist not found"
    );
  }
  return res
    .status(200)
    .json(new ApiRes(200, playlist, "Successfully updated"));
});

export {
  addVideoToPlaylist,
  createPlaylist,
  deletePlaylist,
  getPlaylistById,
  getUserPlaylists,
  removeVideoFromPlaylist,
  updatePlaylist,
};
