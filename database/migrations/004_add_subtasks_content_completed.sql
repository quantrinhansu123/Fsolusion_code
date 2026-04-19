-- Tiểu mục: nội dung nhiều dòng + link ảnh, thời điểm hoàn thành
ALTER TABLE public.subtasks ADD COLUMN IF NOT EXISTS image_url TEXT;
ALTER TABLE public.subtasks ADD COLUMN IF NOT EXISTS content_blocks JSONB DEFAULT '[]'::jsonb;
ALTER TABLE public.subtasks ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ;

UPDATE public.subtasks
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
