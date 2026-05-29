import pytesseract

from PIL import Image

from app.schemas.models import (
    OCRResult,
    OCRWord,
    BoundingBox,
)


def extract_text(image_path: str) -> OCRResult:
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