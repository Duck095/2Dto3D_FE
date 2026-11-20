export const MAX_STUDIO_IMAGE_BYTES = 10 * 1024 * 1024;

const IMAGE_EXTENSIONS_BY_MIME = new Map([
    ['image/png', new Set(['png'])],
    ['image/jpeg', new Set(['jpg', 'jpeg'])],
    ['image/webp', new Set(['webp'])],
]);
const SUPPORTED_IMAGE_MESSAGE = 'Chỉ hỗ trợ hình ảnh PNG, JPEG và WebP.';

export function validateStudioImage(file) {
    const mimeType = typeof file?.type === 'string' ? file.type.trim().toLowerCase() : '';
    const allowedExtensions = IMAGE_EXTENSIONS_BY_MIME.get(mimeType);
    if (!allowedExtensions) {
        return SUPPORTED_IMAGE_MESSAGE;
    }

    if (typeof file.name === 'string' && file.name.trim()) {
        const filename = file.name.trim().toLowerCase();
        const extension = filename.slice(filename.lastIndexOf('.') + 1);
        if (!allowedExtensions.has(extension)) {
            return SUPPORTED_IMAGE_MESSAGE;
        }
    }
    if (!Number.isFinite(file.size) || file.size <= 0) {
        return 'Tệp hình ảnh trống hoặc không hợp lệ.';
    }
    if (file.size > MAX_STUDIO_IMAGE_BYTES) {
        return 'Ảnh không được vượt quá 10 MiB.';
    }

    return null;
}
