-- Hạn chót: lưu cả ngày và giờ (giờ địa phương khi nhập → lưu UTC trong DB)
ALTER TABLE projects ALTER COLUMN deadline TYPE TIMESTAMPTZ USING (
  CASE WHEN deadline IS NULL THEN NULL ELSE (deadline::timestamp AT TIME ZONE 'Asia/Ho_Chi_Minh') END
);
ALTER TABLE features ALTER COLUMN deadline TYPE TIMESTAMPTZ USING (
  CASE WHEN deadline IS NULL THEN NULL ELSE (deadline::timestamp AT TIME ZONE 'Asia/Ho_Chi_Minh') END
);
ALTER TABLE tasks ALTER COLUMN deadline TYPE TIMESTAMPTZ USING (
  CASE WHEN deadline IS NULL THEN NULL ELSE (deadline::timestamp AT TIME ZONE 'Asia/Ho_Chi_Minh') END
);
ALTER TABLE subtasks ALTER COLUMN deadline TYPE TIMESTAMPTZ USING (
  CASE WHEN deadline IS NULL THEN NULL ELSE (deadline::timestamp AT TIME ZONE 'Asia/Ho_Chi_Minh') END
);
