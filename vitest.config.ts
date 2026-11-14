import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
    test: {
        environment: "node",
        include: ["tests/**/*.test.ts"],
        setupFiles: ["tests/setup.ts"],
        fileParallelism: false, // DB 쓰는 테스트가 서로 안 섞이게
        testTimeout: 30000,
    },
    resolve: { alias: { "@": path.resolve(__dirname) } },
});
