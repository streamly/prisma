import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3"
import { getSignedUrl } from "@aws-sdk/s3-request-presigner"

const s3 = new S3Client({
  region: process.env.AWS_REGION,
  credentials: {
    accessKeyId: process.env.AWS_KEY,
    secretAccessKey: process.env.AWS_SECRET,
  },
})

export default async function handler(req, res) {
  try {
    const { filename } = req.query
    if (!filename) {
      return res.status(400).json({ error: "Missing filename parameter" })
    }

    const command = new PutObjectCommand({
      Bucket: process.env.AWS_BUCKET,
      Key: filename,
      ContentType: "image/jpeg",
    })

    const url = await getSignedUrl(s3, command, { expiresIn: 3600 }) // 1 hour

    res.status(200).json({ url })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: "Failed to generate presigned URL" })
  }
}
