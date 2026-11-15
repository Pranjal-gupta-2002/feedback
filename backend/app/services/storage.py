import logging
from typing import Optional
from ..config import settings

logger = logging.getLogger(__name__)

_cloudinary_initialized = False

def init_cloudinary():
    global _cloudinary_initialized
    if _cloudinary_initialized:
        return True

    cloud_name = settings.CLOUDINARY_CLOUD_NAME
    api_key = settings.CLOUDINARY_API_KEY
    api_secret = settings.CLOUDINARY_API_SECRET
    cloudinary_url = settings.CLOUDINARY_URL

    if cloudinary_url or (cloud_name and api_key and api_secret):
        try:
            import cloudinary
            import cloudinary.uploader

            if cloudinary_url:
                cloudinary.config(cloudinary_url=cloudinary_url, secure=True)
            else:
                cloudinary.config(
                    cloud_name=cloud_name,
                    api_key=api_key,
                    api_secret=api_secret,
                    secure=True
                )
            _cloudinary_initialized = True
            logger.info("Cloudinary CDN storage successfully configured.")
            return True
        except Exception as e:
            logger.warning(f"Failed to initialize Cloudinary: {e}")
            return False
    return False

def is_cloud_storage_configured() -> bool:
    """Checks whether Cloudinary cloud storage credentials are configured."""
    return init_cloudinary()

def upload_review_image(image_data: str) -> str:
    """
    Uploads a review image (base64 string or binary) to Cloudinary CDN storage.
    If Cloudinary is configured, returns the secure HTTPS CDN URL.
    If not configured or if upload fails, gracefully falls back to returning the original data string.
    """
    if not image_data or not isinstance(image_data, str):
        return image_data

    # Already an external CDN/HTTP URL
    if image_data.startswith("http://") or image_data.startswith("https://"):
        return image_data

    # Attempt upload to Cloudinary if configured
    if init_cloudinary():
        try:
            import cloudinary.uploader
            res = cloudinary.uploader.upload(
                image_data,
                folder="pulsereview/reviews",
                resource_type="image",
                transformation=[
                    {"quality": "auto:good"},
                    {"fetch_format": "auto"}
                ]
            )
            secure_url = res.get("secure_url") or res.get("url")
            if secure_url:
                logger.info(f"Image uploaded to Cloudinary: {secure_url}")
                return secure_url
        except Exception as e:
            logger.error(f"Cloudinary upload error, falling back to data URL: {e}")

    # Fallback to original image data
    return image_data
