import fs from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import pkg from "node-webpmux";

const { Image } = pkg;

import * as func from "./func.js";

const tmpFileOut = func.tmpFolder(".webp");

/**
 * CONVERTER Class
 * Provides methods to convert media files using ffmpeg
 * Methods:
 * - toPTT: Convert audio to PTT format (OGG)
 * - toAudio: Convert audio to OPUS format
 * - toVideo: Convert video to MP4 format
 * Each method accepts a buffer and the file extension, and returns a Promise that resolves with the converted file data and filename.
 * The conversion process involves writing the input buffer to a temporary file, running ffmpeg with the appropriate arguments, and then reading the output file back into a buffer.
 * Temporary files are cleaned up after conversion.
 * @class
 */
export class CONVERTER {
    /**
     * Convert media using ffmpeg with specified arguments and extensions
     * @param {Buffer} buffer - The input media buffer to be converted
     * @param {string[]} args - The ffmpeg arguments for conversion
     * @param {string} ext - The output file extension
     * @param {string} ext2 - The temporary file extension
     * @returns {Promise<{ data: Buffer, filename: string }>} The converted file data and filename
     */
    ffmpeg(buffer, args = [], ext = "", ext2 = "") {
        return new Promise(async (resolve, reject) => {
            try {
                const tmp = func.tmpFolder(ext2 ? ext2 : ext);
                const out = func.tmpFolder(ext);

                await fs.promises.writeFile(tmp, buffer);

                spawn("ffmpeg", ["-y", "-i", tmp, ...args, out])
                    .on("error", reject)
                    .on("close", async (code) => {
                        try {
                            await fs.promises.unlink(tmp);

                            if (code !== 0) return reject(code);

                            resolve({
                                data: await fs.promises.readFile(out),
                                filename: out
                            });

                            // await fs.promises.unlink(out)
                        } catch (e) {
                            reject(e);
                        };
                    });
            } catch (e) {
                reject(e);
            }
        });
    };

    /**
     * Convert audio to PTT format (OGG)
     * @param {Buffer} buffer - The input audio buffer to be converted
     * @param {string} ext - The output file extension
     * @returns {Promise<{ data: Buffer, filename: string }>} The converted file data and filename
     */
    toPTT(buffer, ext) {
        return this.ffmpeg(
            buffer,
            [
                "-vn",
                "-c:a",
                "libopus",
                "-b:a",
                "128k",
                "-vbr",
                "on"
            ],
            ext,
            "ogg"
        );
    };

    /**
     * Convert audio to OPUS format
     * @param {Buffer} buffer - The input audio buffer to be converted
     * @param {string} ext - The output file extension
     * @returns {Promise<{ data: Buffer, filename: string }>} The converted file data and filename
     */
    toAudio(buffer, ext) {
        return this.ffmpeg(
            buffer,
            [
                "-vn",
                "-c:a",
                "libopus",
                "-b:a",
                "128k",
                "-vbr",
                "on",
                "-compression_level",
                "10"
            ],
            ext,
            "opus"
        );
    };

    /**
     * Convert video to MP4 format
     * @param {Buffer} buffer - The input video buffer to be converted
     * @param {string} ext - The output file extension
     * @returns {Promise<{ data: Buffer, filename: string }>} The converted file data and filename
     */
    toVideo(buffer, ext) {
        return this.ffmpeg(
            buffer,
            [
                "-c:v",
                "libx264",
                "-c:a",
                "aac",
                "-ab",
                "128k",
                "-ar",
                "44100",
                "-crf",
                "32",
                "-preset",
                "slow"
            ],
            ext,
            "mp4"
        );
    };
};

/**
 * EXIF Class
 * Provides methods to convert images and videos to WebP format and write EXIF metadata for stickers
 * Methods:
 * - imageToWebp: Convert an image buffer to WebP format
 * - videoToWebp: Convert a video buffer to WebP format
 * - writeExifImg: Write EXIF metadata to an image buffer and save as WebP
 * - writeExifVid: Write EXIF metadata to a video buffer and save as WebP
 * - writeExif: General method to write EXIF metadata based on media type
 * Each method handles the conversion process using ffmpeg, manages temporary files, and constructs the appropriate EXIF metadata structure for WhatsApp stickers.
 * @class
 * @description This class is designed to facilitate the creation of custom stickers for WhatsApp by allowing users to embed metadata such as pack name and author into the WebP files used for stickers. It supports both images and videos, ensuring that the resulting WebP files are compatible with WhatsApp's sticker requirements.
 */
export class EXIF {
    constructor(convert) {
        this.convert = convert
    };

    /**
     * Convert an image buffer to WebP format
     * @param {Buffer} media - The input image buffer to be converted
     * @returns {Promise<Buffer>} The converted WebP buffer
     */
    imageToWebp = async (media) => {
        const { data } = await this.convert.ffmpeg(
            media,
            [
                "-vcodec", "libwebp",
                "-vf",
                "scale='min(320,iw)':min'(320,ih)':force_original_aspect_ratio=decrease,fps=15,pad=320:320:-1:-1:color=white@0.0"
            ],
            "webp",
            "jpg"
        );

        return data;
    };
    
    /**
     * Convert a video buffer to WebP format
     * @param {Buffer} media - The input video buffer to be converted
     * @returns {Promise<Buffer>} The converted WebP buffer
     */
    videoToWebp = async (media) => {
        const { data } = await this.convert.ffmpeg(
            media,
            [
                "-vcodec", "libwebp",
                "-vf",
                "scale='min(320,iw)':min'(320,ih)':force_original_aspect_ratio=decrease,fps=15,pad=320:320:-1:-1:color=white@0.0",
                "-loop", "0",
                "-ss", "00:00:00",
                "-t", "00:00:05",
                "-preset", "default",
                "-an",
                "-vsync", "0"
            ],
            "webp",
            "mp4"
        );

        return data;
    };
    
    /**
     * Write EXIF metadata to an image buffer and save as WebP
     * @param {Buffer} media - The input image buffer
     * @param {Object} metadata - The metadata to be written
     * @returns {Promise<string>} The path to the saved WebP file
     */
    writeExifImg = async(media, metadata) => {
        let wMedia = await this.imageToWebp(media);
        const tmpFileIn = func.tmpFolder(".webp");
        fs.writeFileSync(tmpFileIn, wMedia);
        if (metadata.packname || metadata.author) {
            const img = new Image();
            const json = {
                "sticker-pack-id": `https://Jawa.com/DAVID`,
                "sticker-pack-name": metadata.packname,
                "sticker-pack-publisher": metadata.author,
                emojis: metadata.categories ? metadata.categories : [""],
            };
            const exifAttr = Buffer.from([
                0x49, 0x49, 0x2a, 0x00, 0x08, 0x00, 0x00, 0x00, 0x01, 0x00, 0x41, 0x57,
                0x07, 0x00, 0x00, 0x00, 0x00, 0x00, 0x16, 0x00, 0x00, 0x00,
            ]);
            const jsonBuff = Buffer.from(JSON.stringify(json), "utf-8");
            const exif = Buffer.concat([exifAttr, jsonBuff]);
            exif.writeUIntLE(jsonBuff.length, 14, 4);
            await img.load(tmpFileIn);
            fs.unlinkSync(tmpFileIn);
            img.exif = exif;
            await img.save(tmpFileOut);
            return tmpFileOut;
        };
    };
    
    /**
     * Write EXIF metadata to a video buffer and save as WebP
     * @param {Buffer} media - The input video buffer
     * @param {Object} metadata - The metadata to be written
     * @returns {Promise<string>} The path to the saved WebP file
     */
    writeExifVid = async(media, metadata) => {
        let wMedia = await this.videoToWebp(media);
        const tmpFileIn = func.tmpFolder(".webp");
        fs.writeFileSync(tmpFileIn, wMedia);
    
        if (metadata.packname || metadata.author) {
            const img = new Image();
            const json = {
                "sticker-pack-id": `https://Jawa.com/DAVID`,
                "sticker-pack-name": metadata.packname,
                "sticker-pack-publisher": metadata.author,
                emojis: metadata.categories ? metadata.categories : [""],
            };
            const exifAttr = Buffer.from([
                0x49, 0x49, 0x2a, 0x00, 0x08, 0x00, 0x00, 0x00, 0x01, 0x00, 0x41, 0x57,
                0x07, 0x00, 0x00, 0x00, 0x00, 0x00, 0x16, 0x00, 0x00, 0x00,
            ]);
            const jsonBuff = Buffer.from(JSON.stringify(json), "utf-8");
            const exif = Buffer.concat([exifAttr, jsonBuff]);
            exif.writeUIntLE(jsonBuff.length, 14, 4);
            await img.load(tmpFileIn);
            fs.unlinkSync(tmpFileIn);
            img.exif = exif;
            await img.save(tmpFileOut);
            return tmpFileOut;
        };
    };
    
    /**
     * Write EXIF metadata to a media buffer and save as WebP
     * @param {Buffer} media - The input media buffer
     * @param {Object} metadata - The metadata to be written
     * @returns {Promise<string>} The path to the saved WebP file
     */
    writeExif = async(media, metadata) => {
        let wMedia = /webp/.test(media.mimetype) ? media.data : /image/.test(media.mimetype) ? await this.imageToWebp(media.data) : /video/.test(media.mimetype) ? await this.videoToWebp(media.data) : "";
        const tmpFileIn = func.tmpFolder(".webp");
        fs.writeFileSync(tmpFileIn, wMedia);
    
        if (metadata.packname || metadata.author) {
            const img = new Image();
            const json = {
                "sticker-pack-id": `https://Jawa.com/DAVID`,
                "sticker-pack-name": metadata.packname,
                "sticker-pack-publisher": metadata.author,
                emojis: metadata.categories ? metadata.categories : [""],
            };
            const exifAttr = Buffer.from([
                0x49, 0x49, 0x2a, 0x00, 0x08, 0x00, 0x00, 0x00, 0x01, 0x00, 0x41, 0x57,
                0x07, 0x00, 0x00, 0x00, 0x00, 0x00, 0x16, 0x00, 0x00, 0x00,
            ]);
            const jsonBuff = Buffer.from(JSON.stringify(json), "utf-8");
            const exif = Buffer.concat([exifAttr, jsonBuff]);
            exif.writeUIntLE(jsonBuff.length, 14, 4);
            await img.load(tmpFileIn);
            fs.unlinkSync(tmpFileIn);
            img.exif = exif;
            await img.save(tmpFileOut);
            return tmpFileOut;
        };
    };
};

func.reloadFile(fileURLToPath(import.meta.url));