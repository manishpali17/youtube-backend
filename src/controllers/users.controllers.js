import jwt from "jsonwebtoken";
import mongoose, { isValidObjectId } from "mongoose";
import { User } from "../models/user.model.js";
import {
  ApiError,
  ApiRes,
  asyncHandler,
  deleteOnCloudinaryWithUrl,
  uploadOnCloudinary,
} from "../utils/index.js";

const signedCookiesOptions = {
  httpOnly: true,
  secure: true,
  expires: Date.now() + 7 * 24 * 60 * 60 * 1000,
  maxAge: 7 * 24 * 60 * 60 * 1000,
  signed: true, // enable signed signedCookies
};

/**
 * Generates access and refresh tokens for a given user ID.
 * @param {string} userId - The ID of the user.
 * @returns {Object} An object containing access and refresh tokens.
 */
const generateAccessAndRefreshTokens = async (userId) => {
  try {
    const user = await User.findById(userId);
    const accessToken = user.generateAccessToken();
    const refreshToken = user.generateRefreshToken();
    user.refreshToken = refreshToken;
    await user.save({ validateBeforeSave: false });

    return { accessToken, refreshToken };
  } catch (error) {
    throw new ApiError(
      500,
      "Something went wrong while generating refresh and access tokens"
    );
  }
};

/**
 * Handles user registration.
 */
const registerUser = asyncHandler(async (req, res) => {
  const { fullName, email, username, password } = req.body;
  if (
    [fullName, email, username, password].some((field) => field?.trim() === "")
  ) {
    throw new ApiError(400, "All fields are required");
  }

  const existedUser = await User.findOne({
    $or: [{ username }, { email }],
  });

  if (existedUser) {
    throw new ApiError(409, "User with email or username already exists");
  }

  const avatarLocalPath = req.files?.avatar[0]?.path;

  let coverImageLocalPath;
  if (
    req.files &&
    Array.isArray(req.files.coverImage) &&
    req.files.coverImage.length > 0
  ) {
    coverImageLocalPath = req.files.coverImage[0].path;
  }

  if (!avatarLocalPath) {
    throw new ApiError(400, "Avatar file is required");
  }

  const avatar = await uploadOnCloudinary(avatarLocalPath);
  const coverImage = await uploadOnCloudinary(coverImageLocalPath);

  if (!avatar) {
    throw new ApiError(400, "Avatar file is required");
  }

  const user = await User.create({
    fullName,
    avatar: avatar.url,
    coverImage: coverImage?.url || "",
    email,
    password,
    username: username.toLowerCase(),
  });

  const createdUser = await User.findById(user._id).select(
    "-password -refreshToken"
  );

  if (!createdUser) {
    throw new ApiError(500, "Something went wrong while registering the user");
  }

  return res
    .status(201)
    .json(new ApiRes(200, createdUser, "User registered successfully"));
});

/**
 * Handles user login.
 */
const loginUser = asyncHandler(async (req, res) => {
  const { email, username, password } = req.body;
  if (!username && !email) {
    throw new ApiError(400, "Username or email is required");
  }
  const user = await User.findOne({ $or: [{ email }, { username }] });

  if (!user) {
    throw new ApiError(404, "User not found");
  }

  if (!user.isPasswordCorrect(password)) {
    throw new ApiError(401, "Invalid user credentials");
  }
  const { refreshToken, accessToken } = await generateAccessAndRefreshTokens(
    user._id
  );

  const newUser = await User.findById(user._id).select(
    "-password -refreshToken"
  );

  return res
    .status(200)
    .cookie("accessToken", accessToken, signedCookiesOptions)
    .cookie("refreshToken", refreshToken, signedCookiesOptions)
    .json(
      new ApiRes(
        200,
        { user: newUser, accessToken, refreshToken },
        "User logged in successfully"
      )
    );
});

/**
 * Handles user logout.
 */
const logoutUser = asyncHandler(async (req, res) => {
  if (!req.user) {
    throw new ApiError(401, "Unauthorized request");
  }
  const user = await User.findByIdAndUpdate(req.user?._id, {
    $unset: {
      refreshToken: 1,
    },
  });
  return res
    .status(200)
    .clearCookie("accessToken", signedCookiesOptions)
    .clearCookie("refreshToken", signedCookiesOptions)
    .json(new ApiRes(200, {}, "User logged out"));
});

/**
 * Handles refreshing access tokens.
 */
const refreshAccessToken = asyncHandler(async (req, res) => {
  const incomingRefreshToken =
    req.signedCookies.refreshToken || req.body.refreshToken;

  if (!incomingRefreshToken || incomingRefreshToken === "undefined") {
    throw new ApiError(401, "Unauthorized request");
  }
  const decodedToken = jwt.verify(
    incomingRefreshToken,
    process.env.REFRESH_TOKEN_SECRET
  );

  const user = await User.findById(decodedToken?._id);

  if (!user) throw new ApiError(401, "Invalid refresh token");

  if (incomingRefreshToken !== user.refreshToken)
    throw new ApiError(401, "Refresh token is expired or used");

  const { accessToken, refreshToken } = await generateAccessAndRefreshTokens(
    user._id
  );

  return res
    .status(200)
    .cookie("accessToken", accessToken, signedCookiesOptions)
    .cookie("refreshToken", refreshToken, signedCookiesOptions)
    .json(
      new ApiRes(
        200,
        {
          accessToken: accessToken,
          refreshToken: refreshToken,
        },
        "Access token refreshed"
      )
    );
});

/**
 * Retrieves information about the current user.
 */
const getCurrentUser = asyncHandler((req, res) => {
  return res
    .status(200)
    .json(new ApiRes(201, { user: req.user }, "User fetched successfully"));
});

/**
 * Handles changing the user's password.
 */
const changePassword = asyncHandler(async (req, res) => {
  const { newPassword, oldPassword } = req.body;

  if (!(newPassword && oldPassword))
    throw new ApiError(400, "Password required");

  const user = await User.findById(req.user?._id);

  const passwordIsCorrect = user.isPasswordCorrect(oldPassword);

  if (!passwordIsCorrect) {
    throw new ApiError(400, "Wrong Old Password");
  }

  user.password = newPassword;

  await user.save({ validateBeforeSave: false });

  return res
    .status(200)
    .json(new ApiRes(200), {}, "Password updated successfully");
});

/**
 * Handles updating user details.
 */
const updateUserDetails = asyncHandler(async (req, res) => {
  const { fullName, email } = req.body;

  if (!fullName || !email) {
    throw new ApiError(400, "All fields are required");
  }

  const user = await User.findByIdAndUpdate(
    req.user?._id,
    {
      $set: {
        fullName: fullName,
        email: email,
      },
    },
    { new: true }
  ).select("-password -refreshToken");

  return res
    .status(200)
    .json(new ApiRes(200, user, "Account details updated successfully"));
});

/**
 * Handles updating user avatar image.
 */
const updateAvatarImage = asyncHandler(async (req, res) => {
  // Updating cloudinaryUrl
  const localPath = req.file?.path;

  if (!localPath) throw new ApiError(400, "Image is required");

  const avatar = await uploadOnCloudinary(localPath);

  if (!avatar.url) throw new ApiError(400, "Error while uploading avatar");

  const user = await User.findByIdAndUpdate(req.user?._id, {
    $set: {
      avatar: avatar.url,
    },
  });

  if (!user) throw new ApiError(400, "Error while updating avatar");
  const oldUrl = user?.avatar;

  const response = await deleteOnCloudinaryWithUrl(oldUrl, {
    resource_type: "image",
  });
  console.log(response);

  const updatedUser = await User.findById(user._id).select(
    "-password -refreshToken"
  );
  return res
    .status(200)
    .json(new ApiRes(200, updatedUser, "Avatar updated successfully"));
});

/**
 * Handles updating user cover image.
 */
const updateUserCoverImage = asyncHandler(async (req, res) => {
  const coverImageLocalPath = req.file?.path;

  if (!coverImageLocalPath) {
    throw new ApiError(400, "Cover image file is missing");
  }

  const coverImage = await uploadOnCloudinary(coverImageLocalPath);

  if (!coverImage.url) {
    throw new ApiError(400, "Error while uploading cover image");
  }

  const updatedUser = await User.findByIdAndUpdate(req.user?._id, {
    $set: {
      coverImage: coverImage.url,
    },
  }).select("-password -refreshToken");

  deleteOnCloudinaryWithUrl(updatedUser.coverImage, { resource_type: "image" });
  const user = await User.findById(updatedUser._id);

  return res
    .status(200)
    .json(new ApiRes(200, user, "Cover image updated successfully"));
});

/**
 * Retrieves information about a user's channel profile.
 */
const getUserChannelProfile = asyncHandler(async (req, res) => {
  const { username } = req.params;

  if (!username?.trim()) {
    throw new ApiError(400, "Username is missing");
  }

  const channel = await User.aggregate([
    {
      $match: {
        username: username?.toLowerCase(),
      },
    },
    {
      $lookup: {
        from: "subscriptions",
        localField: "_id",
        foreignField: "channel",
        as: "subscribers",
      },
    },
    {
      $lookup: {
        from: "subscriptions",
        localField: "_id",
        foreignField: "subscriber",
        as: "subscribedTo",
      },
    },
    {
      $addFields: {
        subscribersCount: {
          $size: "$subscribers",
        },
        channelsSubscribedToCount: {
          $size: "$subscribedTo",
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
        fullName: 1,
        username: 1,
        subscribersCount: 1,
        channelsSubscribedToCount: 1,
        isSubscribed: 1,
        avatar: 1,
        coverImage: 1,
        email: 1,
      },
    },
  ]);

  if (!channel?.length) {
    throw new ApiError(404, "Channel does not exist");
  }

  return res
    .status(200)
    .json(new ApiRes(200, channel[0], "User channel fetched successfully"));
});

/**
 * Retrieves a user's watch history.
 */
const getWatchHistory = asyncHandler(async (req, res) => {
  const user = await User.aggregate([
    {
      $match: {
        _id: new mongoose.Types.ObjectId(req.user._id),
      },
    },
    {
      $lookup: {
        from: "videos",
        localField: "watchHistory",
        foreignField: "_id",
        as: "watchHistory",
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
              owner: {
                $first: "$owner",
              },
            },
          },
        ],
      },
    },
  ]);

  return res
    .status(200)
    .json(
      new ApiRes(
        200,
        user[0].watchHistory,
        "Watch history fetched successfully"
      )
    );
});
/**
 * Remove Video form user watch history.
 */
const removeVideoFromWatchHistory = asyncHandler(async (req, res) => {
  const { videoId } = req.params;
  if (!isValidObjectId(videoId)) {
    throw new ApiError(400, "Invalid videoId");
  }
  const user = await User.findByIdAndUpdate(
    req.user?._id,
    {
      $pull: {
        watchHistory: videoId,
      },
    },
    { new: true }
  ).select("-password -refreshToken");
  if (!user) {
    throw new ApiError(500, "Error ouccerd while removing from watchHistory");
  }
  return res
    .status(200)
    .json(
      new ApiRes(200, user, "Video removed from Watch history successfully")
    );
});
/**
 * Destroy the user account
 */
const deleteUserAccount = asyncHandler(async (req, res) => {
  const user = await User.findOneAndDelete({ _id: req.user?._id });
  if (!user) {
    throw new ApiError(500, "Error ouccerd while deleting user account");
  }
  const avatar = await deleteOnCloudinaryWithUrl(user.avatar);
  const coverImage = await deleteOnCloudinaryWithUrl(user.coverImage);
  if (avatar.error || coverImage.error) {
    throw new ApiError(500, "Error while deleting on cloudinary");
  }
  return res.status(200).json(new ApiRes(200, {}, "Account deleted"));
});

export {
  changePassword,
  deleteUserAccount,
  getCurrentUser,
  getUserChannelProfile,
  getWatchHistory,
  loginUser,
  logoutUser,
  refreshAccessToken,
  registerUser,
  removeVideoFromWatchHistory,
  updateAvatarImage,
  updateUserCoverImage,
  updateUserDetails,
};
