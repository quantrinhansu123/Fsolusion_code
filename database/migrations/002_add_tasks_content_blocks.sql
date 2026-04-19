-- Nhiều cặp nội dung + link ảnh trên task
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS content_blocks JSONB DEFAULT '[]'::jsonb;

-- Gộp description / image_url cũ thành một phần tử trong mảng (nếu chưa có dữ liệu JSON)
UPDATE tasks
SET content_blocks = jsonb_build_array(
  jsonb_build_object(
    'content', COALESCE(description, ''),
    'image_url', COALESCE(image_url, '')
  )
)
WHERE (
  content_blocks IS NULL
  OR content_blocks = '[]'::jsonb
  OR jsonb_array_length(COALESCE(content_blocks, '[]'::jsonb)) = 0
)
AND (
  (description IS NOT NULL AND TRIM(description) <> '')
  OR (image_url IS NOT NULL AND TRIM(image_url) <> '')
);
