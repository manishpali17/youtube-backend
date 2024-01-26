import { v2 as cloudinary } from "cloudinary";
import fs from "fs";

cloudinary.config({
  cloud_name: process.env.CLOUD_NAME,

  api_key: process.env.CLOUD_API_KEY,
  api_secret: process.env.CLOUD_API_SECRET,
});

export const uploadOnCloudinary = async (localFilePath) => {
  try {
    if (!localFilePath) return null;
    const response = await cloudinary.uploader.upload(localFilePath, {
      resource_type: "auto",
      folder: "YouTube",
      use_filename: true,
    });
    fs.unlinkSync(localFilePath);
    return response;
  } catch (error) {
    fs.unlinkSync(localFilePath);
    return null;
  }
};
export const deleteOnCloudinary = async (
  public_id,
  options = {
    resource_type: "image",
  }
) => {
  try {
    if (!public_id) return "public_id is required";
    const res = await cloudinary.uploader.destroy(public_id, options);
    return res;
  } catch (error) {
    return error;
  }
};
export const deleteOnCloudinaryWithUrl = async (imageUrl, option) => {
  try {
    const parts = imageUrl.split("/");
    let publicId = parts[parts.length - 1];
    publicId = publicId.split(".")[0];
    if (!publicId) return "public id is required";
    const res = await cloudinary.uploader.destroy(publicId, option);
    return res;
  } catch (error) {
    return error;
  }
};
