-- CreateTable
CREATE TABLE `wish` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `body` VARCHAR(160) NOT NULL,
    `lang` VARCHAR(8) NOT NULL,
    `voter_key` VARCHAR(64) NOT NULL,
    `ip_hash` VARCHAR(64) NULL,
    `kst_day` VARCHAR(10) NOT NULL,
    `status` VARCHAR(16) NOT NULL DEFAULT 'public',
    `cheer_count` INTEGER NOT NULL DEFAULT 0,
    `report_count` INTEGER NOT NULL DEFAULT 0,
    `created_at` TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),

    INDEX `wish_kst_day_status_idx`(`kst_day`, `status`),
    INDEX `wish_voter_key_kst_day_idx`(`voter_key`, `kst_day`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `wish_cheer` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `wish_id` INTEGER NOT NULL,
    `voter_key` VARCHAR(64) NOT NULL,
    `created_at` TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),

    UNIQUE INDEX `wish_cheer_wish_id_voter_key_key`(`wish_id`, `voter_key`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `wish_report` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `wish_id` INTEGER NOT NULL,
    `ip_hash` VARCHAR(64) NOT NULL,
    `created_at` TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),

    UNIQUE INDEX `wish_report_wish_id_ip_hash_key`(`wish_id`, `ip_hash`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `wish_cheer` ADD CONSTRAINT `wish_cheer_wish_id_fkey` FOREIGN KEY (`wish_id`) REFERENCES `wish`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `wish_report` ADD CONSTRAINT `wish_report_wish_id_fkey` FOREIGN KEY (`wish_id`) REFERENCES `wish`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
