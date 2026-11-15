-- 소원 고정(관리자): 하루가 지나도 하늘에 남음. 하늘 조회는 만든 시각 기준(24시간)
ALTER TABLE `wish` ADD COLUMN `pinned` BOOLEAN NOT NULL DEFAULT false;
CREATE INDEX `wish_created_at_status_idx` ON `wish`(`created_at`, `status`);
