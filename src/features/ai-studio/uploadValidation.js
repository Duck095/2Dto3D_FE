export function validateStudioImage(file) {
    if (!file || typeof file.type !== 'string' || !file.type.startsWith('image/')) {
        return 'Chọn một tệp hình ảnh hợp lệ để tiếp tục.';
    }

    return null;
}
