import { faker } from "@faker-js/faker";
import fs from "fs";
import { User } from "../models/user.model.js";
import { Video } from "../models/video.model.js";
import { Like } from "../models/like.model.js";
import { Comment } from "../models/comment.model.js";
import { Tweet } from "../models/tweet.model.js";
import { Subscription } from "../models/subscription.model.js";
import { Playlist } from "../models/playlist.model.js";
import {
  asyncHandler,
  ApiError,
  ApiRes,
  removeLocalFile,
  getRandomNumber,
} from "../utils/index.js";

const USERS_COUNT = 10;
const VIDEO_COUNT = USERS_COUNT * 3;
const COMMENT_COUNT = USERS_COUNT * 3;
const TWEET_COUNT = USERS_COUNT * 3;
const SUBSCRIPTION_COUNT = USERS_COUNT * 2;
const PLAYLIST_COUNT = USERS_COUNT * 3;
const LIKE_COUNT = USERS_COUNT * 4;

const users = new Array(USERS_COUNT).fill("_").map(() => ({
  fullName: faker.person.fullName(),
  avatar: faker.image.avatar(),
  username: faker.internet.userName(),
  email: faker.internet.email(),
  password: faker.internet.password(),
  coverImage: faker.image.avatar(),
}));

const seedUsers = asyncHandler(async (req, res, next) => {
  const userCount = await User.countDocuments();
  if (userCount >= USERS_COUNT) {
    // Don't re-generate the users if we already have them in the database
    next();
    return;
  }
  await User.deleteMany({}); // delete all the existing users from previous seedings
  removeLocalFile("./public/temp/seed-credentials.json"); // remove old credentials

  const credentials = [];

  // create Promise array
  const userCreationPromise = users.map(async (user) => {
    credentials.push({
      username: user.username.toLowerCase(),
      password: user.password,
    });
    await User.create(user);
  });

  // pass promises array to the Promise.all method
  await Promise.all(userCreationPromise);

  // Once users are created dump the credentials to the json file
  const json = JSON.stringify(credentials);

  fs.writeFileSync(
    "./public/temp/seed-credentials.json",
    json,
    "utf8",
    (err) => {
      console.log("Error while writing the credentials", err);
    }
  );

  // proceed with the request
  next();
});

/**
 * @description This api gives the saved credentials generated while seeding.
 */
const getGeneratedCredentials = asyncHandler(async (req, res) => {
  try {
    const json = fs.readFileSync("./public/temp/seed-credentials.json", "utf8");
    return res
      .status(200)
      .json(
        new ApiRes(
          200,
          JSON.parse(json),
          "Dummy credentials fetched successfully"
        )
      );
  } catch (error) {
    throw new ApiError(404, "No credentials generated yet.");
  }
});

const videos = new Array(VIDEO_COUNT).fill("_").map(() => ({
  title: faker.lorem.word(),
  description: faker.lorem.lines({ min: 1, max: 2 }),
  duration: faker.number.int({ max: 24, min: 1 }),
  videoFile: {
    url: faker.image.avatar(),
    fileName: faker.lorem.word(),
  },
  thumbnail: {
    url: faker.image.avatar(),
    fileName: faker.lorem.word(),
  },
  isPublished: true,
  views: 0,
}));
const seedVideos = async () => {
  const users = await User.find();
  await Video.deleteMany({});
  await Video.insertMany(
    videos.map((video, i) => {
      return {
        ...video,
        owner: users[i] ?? users[getRandomNumber(users.length)],
      };
    })
  );
};

const comments = new Array(COMMENT_COUNT).fill("_").map(() => ({
  content: faker.lorem.lines({ min: 1, max: 2 }),
}));

const seedComments = async () => {
  const users = await User.find();
  const videos = await Video.find();
  await Comment.deleteMany({});
  await Comment.insertMany(
    comments.map((comment, i) => {
      return {
        ...comment,
        owner: users[i] ?? users[getRandomNumber(users.length)],
        video: videos[i] ?? videos[getGeneratedCredentials(videos.length)],
      };
    })
  );
};

const tweets = new Array(TWEET_COUNT).fill("_").map(() => ({
  content: faker.lorem.lines({ min: 1, max: 2 }),
}));

const seedTweet = async () => {
  const users = await User.find();
  await Tweet.deleteMany({});
  await Tweet.insertMany(
    tweets.map((tweet, i) => {
      return {
        ...tweet,
        owner: users[i] ?? users[getRandomNumber(users.length)],
      };
    })
  );
};

const seedPlaylists = async () => {
  const users = await User.find();
  const videos = await Video.find();

  await Playlist.deleteMany();

  const playlists = new Array(PLAYLIST_COUNT).fill("_").map(() => ({
    name: faker.lorem.words({ min: 1, max: 3 }),
    description: faker.lorem.lines({ min: 1, max: 2 }),
    videos: videos.slice(0, getRandomNumber(videos.length)),
    owner: users[getRandomNumber(users.length)],
  }));

  await Playlist.insertMany(playlists);
};

const seedSubscriptions = async () => {
  const users = await User.find(); // Assuming User model is imported and defined
  await Subscription.deleteMany({});

  const subscriptions = new Array(SUBSCRIPTION_COUNT).fill("_").map(() => ({
    subscriber: users[getRandomNumber(users.length)],
    channel: users[getRandomNumber(users.length)],
  }));

  await Subscription.insertMany(subscriptions);
};

const seedLikes = async () => {
  const users = await User.find();
  const videos = await Video.find();
  const comments = await Comment.find();
  const tweets = await Tweet.find();

  await Like.deleteMany();

  const likes = new Array(LIKE_COUNT).fill("_").map(() => ({
    video: videos[getRandomNumber(videos.length)],
    comment: comments[getRandomNumber(comments.length)],
    tweet: tweets[getRandomNumber(tweets.length)],
    likedBy: users[getRandomNumber(users.length)],
  }));

  await Like.insertMany(likes);
};

const seedYoutube = asyncHandler(async (req, res) => {
  await seedVideos();
  await seedComments();
  await seedTweet();
  await seedPlaylists();
  await seedLikes();
  await seedSubscriptions();
  return res.status(201).json(new ApiRes(201, {}, "success"));
});

export { getGeneratedCredentials, seedUsers, seedYoutube };
