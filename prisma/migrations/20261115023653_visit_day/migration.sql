-- CreateTable
CREATE TABLE `visit_day` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `day` VARCHAR(10) NOT NULL,
    `voter_key` VARCHAR(64) NOT NULL,
    `lang` VARCHAR(8) NOT NULL,
    `created_at` TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),

    INDEX `visit_day_day_idx`(`day`),
    UNIQUE INDEX `visit_day_day_voter_key_key`(`day`, `voter_key`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
