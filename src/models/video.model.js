import mongoose from "mongoose";
import mongooseAggregatePaginate from "mongoose-aggregate-paginate-v2";
import { Comment } from "./comment.model.js";
import { Like } from "./like.model.js";
import { User } from "./user.model.js";
import { deleteOnCloudinary } from "../utils/cloudinary.js";
const videoSchema = new mongoose.Schema(
  {
    videoFile: {
      fileName: {
        type: String,
        required: true,
      },
      url: {
        type: String,
        reqiured: true,
      },
    },
    thumbnail: {
      fileName: {
        type: String,
        reqiured: true,
      },
      url: {
        type: String,
        reqiured: true,
      },
    },
    owner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    title: {
      type: String,
      required: true,
    },
    description: {
      type: String,
      required: true,
    },
    duration: {
      type: Number,
      required: true,
    },
    views: {
      type: Number,
      defaultValue: 0,
    },
    isPublished: {
      type: Boolean,
    },
  },
  { timestamps: true }
);

videoSchema.plugin(mongooseAggregatePaginate);

videoSchema.post("findOneAndDelete", async (video, next) => {
  if (video) {
    try {
      const commentTodelete = await Comment.find({ video: video._id });
      for (const comment in commentTodelete) {
        await Comment.findOneAndDelete(comment._id);
      }
      await Like.find({ video: video._id });
      await User.findOneAndUpdate(
        { _id: video.owner },
        { $pull: { watchHistory: video._id } }
      );
      const result = await deleteOnCloudinary(video.videoFile.fileName, {
        resource_type: "video",
      });
      console.log(result);
      const thumbnail = await deleteOnCloudinary(video.thumbnail.fileName);
      console.log(thumbnail);
    } catch (error) {
      console.error(`Error deleting video: ${error.message}`);
    }
    next();
  }
  next();
});

export const Video = mongoose.model("Video", videoSchema);
