import pytesseract

from PIL import Image, UnidentifiedImageError

from app.schemas.models import (
    OCRResult,
    OCRWord,
    BoundingBox,
    OCRError,
)


def extract_text(image_path: str) -> OCRResult:
    try:
        image = Image.open(image_path)

        grayscale = image.convert("L")

        data = pytesseract.image_to_data(
            grayscale,
            output_type=pytesseract.Output.DICT
        )

        words = []

        full_text = []

        total_items = len(data["text"])

        for i in range(total_items):
            text = data["text"][i].strip()

            if not text:
                continue

            confidence = float(data["conf"][i])

            x = data["left"][i]
            y = data["top"][i]
            width = data["width"][i]
            height = data["height"][i]

            full_text.append(text)

            words.append(
                OCRWord(
                    text=text,
                    confidence=confidence,
                    bbox=BoundingBox(
                        x=x,
                        y=y,
                        width=width,
                        height=height
                    )
                )
            )

        return OCRResult(
            text=" ".join(full_text),
            words=words
        )

    except OCRError:
        raise

    except (FileNotFoundError, UnidentifiedImageError, OSError) as exc:
        raise OCRError(
            message=f"Failed to process image '{image_path}': {exc}",
            stage="ocr",
        ) from exc

    except Exception as exc:
        raise OCRError(
            message=f"Unexpected OCR failure for '{image_path}': {exc}",
            stage="ocr",
        ) from exc