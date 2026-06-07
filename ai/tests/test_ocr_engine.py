"""
Tests for app.analyzers.ocr_engine.extract_text

Validates Requirements 1.2:
  WHEN a User uploads a valid image file, THE OCR_Engine SHALL extract all
  visible text using pytesseract and Pillow and return structured text data
  with each word and its bounding-box coordinates.
"""
import os
import tempfile

import pytest
from PIL import Image, ImageDraw, ImageFont

from app.analyzers.ocr_engine import extract_text
from app.schemas.models import BoundingBox, OCRError, OCRResult, OCRWord


# ---------------------------------------------------------------------------
# Helpers / fixtures
# ---------------------------------------------------------------------------


def _make_text_image(text: str, size: tuple[int, int] = (400, 100)) -> Image.Image:
    """Create a white PIL image with black text drawn on it."""
    img = Image.new("RGB", size, color=(255, 255, 255))
    draw = ImageDraw.Draw(img)
    # Use the default bitmap font; always available even without system fonts.
    draw.text((10, 30), text, fill=(0, 0, 0))
    return img


@pytest.fixture()
def synthetic_image_path(tmp_path):
    """
    Write a synthetic PNG image containing a short, well-separated phrase to
    a temporary file and return the path.  The image is large enough and the
    text contrast high enough that Tesseract reliably detects at least one
    word.
    """
    img = _make_text_image("HELLO WORLD", size=(500, 120))
    path = str(tmp_path / "synthetic_test.png")
    img.save(path)
    return path


@pytest.fixture()
def corrupt_image_path(tmp_path):
    """Return the path to a file that is NOT a valid image."""
    path = str(tmp_path / "corrupt.png")
    with open(path, "wb") as fh:
        fh.write(b"this is not a valid image file \x00\xff")
    return path


# ---------------------------------------------------------------------------
# Unit tests — happy path (Requirements 1.2)
# ---------------------------------------------------------------------------


class TestExtractTextReturnsOCRResult:
    """extract_text returns a well-formed OCRResult for a valid image."""

    def test_returns_ocr_result_type(self, synthetic_image_path):
        result = extract_text(synthetic_image_path)
        assert isinstance(result, OCRResult), (
            "extract_text should return an OCRResult instance"
        )

    def test_result_has_text_attribute(self, synthetic_image_path):
        result = extract_text(synthetic_image_path)
        assert isinstance(result.text, str), "OCRResult.text must be a str"

    def test_result_has_words_list(self, synthetic_image_path):
        result = extract_text(synthetic_image_path)
        assert isinstance(result.words, list), "OCRResult.words must be a list"


class TestOCRWordStructure:
    """Each element of OCRResult.words is a valid OCRWord with required fields."""

    def test_words_array_is_non_empty(self, synthetic_image_path):
        """
        Validates: Requirements 1.2
        A synthetic image with high-contrast text must yield at least one word.
        """
        result = extract_text(synthetic_image_path)
        assert len(result.words) > 0, (
            "OCR of a clear text image must produce at least one OCRWord"
        )

    def test_each_word_has_text_field(self, synthetic_image_path):
        """Validates: Requirements 1.2"""
        result = extract_text(synthetic_image_path)
        for word in result.words:
            assert isinstance(word, OCRWord), "Each element must be an OCRWord"
            assert isinstance(word.text, str) and word.text, (
                "OCRWord.text must be a non-empty string"
            )

    def test_each_word_has_confidence_field(self, synthetic_image_path):
        """Validates: Requirements 1.2"""
        result = extract_text(synthetic_image_path)
        for word in result.words:
            assert isinstance(word.confidence, float), (
                "OCRWord.confidence must be a float"
            )

    def test_each_word_has_bbox_field(self, synthetic_image_path):
        """Validates: Requirements 1.2"""
        result = extract_text(synthetic_image_path)
        for word in result.words:
            assert isinstance(word.bbox, BoundingBox), (
                "OCRWord.bbox must be a BoundingBox"
            )

    def test_bbox_has_x_y_width_height_as_floats(self, synthetic_image_path):
        """
        Validates: Requirements 1.2
        BoundingBox must expose x, y, width, height as floats.
        """
        result = extract_text(synthetic_image_path)
        for word in result.words:
            bbox = word.bbox
            for attr in ("x", "y", "width", "height"):
                value = getattr(bbox, attr)
                assert isinstance(value, (int, float)), (
                    f"BoundingBox.{attr} must be numeric, got {type(value)}"
                )

    def test_bbox_dimensions_are_non_negative(self, synthetic_image_path):
        """Width and height of bounding boxes must be non-negative."""
        result = extract_text(synthetic_image_path)
        for word in result.words:
            assert word.bbox.width >= 0, "BoundingBox.width must be >= 0"
            assert word.bbox.height >= 0, "BoundingBox.height must be >= 0"

    def test_full_text_contains_words(self, synthetic_image_path):
        """OCRResult.text is composed of the words Tesseract detected."""
        result = extract_text(synthetic_image_path)
        if result.words:
            # Each word's text should appear somewhere in the full text string
            for word in result.words:
                assert word.text in result.text, (
                    f"Word '{word.text}' should be present in OCRResult.text"
                )


# ---------------------------------------------------------------------------
# Unit tests — failure path
# ---------------------------------------------------------------------------


class TestExtractTextErrorHandling:
    """extract_text raises OCRError with stage='ocr' on bad inputs."""

    def test_nonexistent_path_raises_ocr_error(self, tmp_path):
        """A path to a file that does not exist must raise OCRError."""
        missing = str(tmp_path / "does_not_exist.png")
        with pytest.raises(OCRError) as exc_info:
            extract_text(missing)
        assert exc_info.value.stage == "ocr", (
            "OCRError.stage must be 'ocr' for a missing-file failure"
        )

    def test_corrupt_image_raises_ocr_error(self, corrupt_image_path):
        """A file that is not a valid image format must raise OCRError."""
        with pytest.raises(OCRError) as exc_info:
            extract_text(corrupt_image_path)
        assert exc_info.value.stage == "ocr", (
            "OCRError.stage must be 'ocr' for a corrupt-image failure"
        )

    def test_ocr_error_is_exception_subclass(self, corrupt_image_path):
        """OCRError must be catchable as a plain Exception."""
        with pytest.raises(Exception):
            extract_text(corrupt_image_path)

    def test_ocr_error_has_message(self, corrupt_image_path):
        """OCRError should carry a human-readable message."""
        with pytest.raises(OCRError) as exc_info:
            extract_text(corrupt_image_path)
        assert exc_info.value.message, (
            "OCRError.message must not be empty"
        )
