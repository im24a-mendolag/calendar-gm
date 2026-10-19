-- CreateTable
CREATE TABLE "periods" (
    "user_id" TEXT NOT NULL,
    "number" SMALLINT NOT NULL,
    "start_time" TIME(0) NOT NULL,
    "end_time" TIME(0) NOT NULL,

    CONSTRAINT "periods_pkey" PRIMARY KEY ("user_id","number")
);

-- AddForeignKey
ALTER TABLE "periods" ADD CONSTRAINT "periods_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;
