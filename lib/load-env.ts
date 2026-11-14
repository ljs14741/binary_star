// .env.local → .env 순서로 읽음. server.ts 맨 위에서 import (import 는 먼저 평가되니 이 파일이 가장 앞에 와야 함)
import dotenv from "dotenv";
dotenv.config({ path: [".env.local", ".env"], quiet: true });
