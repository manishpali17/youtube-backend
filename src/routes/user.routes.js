import express from "express";
import { upload } from "../middlewares/multer.middleware.js";
import { verifyJWT } from "../middlewares/auth.middleware.js";
import { limiter } from "../middlewares/limiter.middleware.js";

import {
  registerUser,
  loginUser,
  logoutUser,
  refreshAccessToken,
  getCurrentUser,
  changePassword,
  updateUserDetails,
  updateAvatarImage,
  updateUserCoverImage,
  getUserChannelProfile,
  getWatchHistory,
  deleteUserAccount,
  removeVideoFromWatchHistory,
} from "../controllers/users.controllers.js";

const router = express.Router();

router.route("/register").post(
  limiter,
  upload.fields([
    {
      name: "avatar",
      maxCount: 1,
    },
    { name: "coverImage", maxCount: 1 },
  ]),
  registerUser
);
router.route("/login").post(loginUser);
router.route("/c/:username").get(getUserChannelProfile);

// secured routes
router.route("/logout").post(verifyJWT, logoutUser);
router.route("/refresh-token").get(refreshAccessToken);
router.route("/getuser").get(verifyJWT, getCurrentUser);
router.route("/change-password").post(verifyJWT, changePassword);
router.route("/update-user-details").patch(verifyJWT, updateUserDetails);
router
  .route("/update-avatar")
  .patch(verifyJWT, limiter, upload.single("avatar"), updateAvatarImage);
router
  .route("/update-cover-image")
  .patch(verifyJWT, limiter, upload.single("coverImage"), updateUserCoverImage);
router.route("/history").get(verifyJWT, getWatchHistory);
router
  .route("/history/remove-video/:videoId")
  .patch(verifyJWT, removeVideoFromWatchHistory);
router.route("/delete-user").delete(verifyJWT, deleteUserAccount);

export default router;
