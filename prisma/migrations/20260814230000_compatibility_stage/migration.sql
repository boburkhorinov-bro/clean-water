-- Tozalash bosqichi tartibi (§3).
--
-- Ixtiyoriy: tartib berilmagan mosliklar mahsulot kartochkasida raqamsiz
-- ro'yxat bo'lib chiqadi. O'ylab topilgan tartibni ko'rsatishdan ko'ra
-- tartibsiz ko'rsatish to'g'riroq — §3 dekorativ shkalani rad etadi.
ALTER TABLE "compatibilities" ADD COLUMN "stage" INTEGER;

-- Kartochka bosqichlarni shu tartibda o'qiydi.
CREATE INDEX "compatibilities_filter_id_stage_idx" ON "compatibilities"("filter_id", "stage");
