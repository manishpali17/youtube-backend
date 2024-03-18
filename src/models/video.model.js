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
        required: true,
      },
    },
    thumbnail: {
      fileName: {
        type: String,
        required: true,
      },
      url: {
        type: String,
        required: true,
      },
    },
    owner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
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
      default: 0,
    },
    isPublished: {
      type: Boolean,
    },
    categories: {
      type: String,
      enum: [
        "Autos & Vehicles",
        "Comedy",
        "Education",
        "Entertainment",
        "Film & Animation",
        "Gaming",
        "Howto & Style",
        "Music",
        "News & Politics",
        "Nonprofits & Activism",
        "People & Blogs",
        "Pets & Animals",
        "Science & Technology",
        "Sports",
        "Travel & Events",
        "",
      ],
      default: "",
    },
    tags: [
      {
        type: String,
      },
    ],
  },
  { timestamps: true }
);

videoSchema.plugin(mongooseAggregatePaginate);

videoSchema.post("findOneAndDelete", async (video, next) => {
  if (video) {
    try {
      // Deleting associated comments
      const commentsToDelete = await Comment.find({ video: video._id });
      for (const comment of commentsToDelete) {
        await Comment.findByIdAndDelete(comment._id);
      }

      // Deleting associated likes
      await Like.deleteMany({ video: video._id });

      // Removing the video from user's watch history
      await User.findOneAndUpdate(
        { _id: video.owner },
        { $pull: { watchHistory: video._id } }
      );

      // Deleting files from Cloudinary
      const result = await deleteOnCloudinary(video.videoFile.fileName, {
        resource_type: "video",
      });
      console.log(result);
      const thumbnail = await deleteOnCloudinary(video.thumbnail.fileName);
      console.log(thumbnail);
    } catch (error) {
      console.error(`Error deleting video: ${error.message}`);
      // Ensure the error is propagated properly
      return next(error);
    }
  }
  next();
});

export const Video = mongoose.model("Video", videoSchema);
