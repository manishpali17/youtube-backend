import { Router } from "express";
import {
  getChannelStats,
  getChannelVideos,
} from "../controllers/dashboard.controller.js";
import { verifyJWT } from "../middlewares/auth.middleware.js";
const router = Router();

router.route("/stats/:channelId").get(verifyJWT, getChannelStats);
router.route("/videos/:channelId").get(getChannelVideos);

export default router;
