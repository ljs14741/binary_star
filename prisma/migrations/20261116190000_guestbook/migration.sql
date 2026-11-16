-- CreateTable
CREATE TABLE `guestbook` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `nickname` VARCHAR(40) NULL,
    `body` VARCHAR(1200) NOT NULL,
    `lang` VARCHAR(8) NOT NULL,
    `country` VARCHAR(2) NULL,
    `voter_key` VARCHAR(64) NOT NULL,
    `ip_hash` VARCHAR(64) NULL,
    `kst_day` VARCHAR(10) NOT NULL,
    `status` VARCHAR(16) NOT NULL DEFAULT 'public',
    `report_count` INTEGER NOT NULL DEFAULT 0,
    `reply` VARCHAR(1200) NULL,
    `reply_at` TIMESTAMP(0) NULL,
    `created_at` TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),

    INDEX `guestbook_status_id_idx`(`status`, `id`),
    INDEX `guestbook_voter_key_kst_day_idx`(`voter_key`, `kst_day`),
    INDEX `guestbook_ip_hash_kst_day_idx`(`ip_hash`, `kst_day`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `guestbook_report` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `guestbook_id` INTEGER NOT NULL,
    `ip_hash` VARCHAR(64) NOT NULL,
    `created_at` TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),

    UNIQUE INDEX `guestbook_report_guestbook_id_ip_hash_key`(`guestbook_id`, `ip_hash`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `guestbook_report` ADD CONSTRAINT `guestbook_report_guestbook_id_fkey` FOREIGN KEY (`guestbook_id`) REFERENCES `guestbook`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
