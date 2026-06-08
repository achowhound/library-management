UPDATE "Copy"
SET "barcode" = (
  SELECT numbered."isbn" || ' ' || numbered."copyNumber"
  FROM (
    SELECT
      c."id",
      b."isbn",
      ROW_NUMBER() OVER (PARTITION BY c."bookId" ORDER BY c."id") AS "copyNumber"
    FROM "Copy" c
    JOIN "Book" b ON b."id" = c."bookId"
  ) numbered
  WHERE numbered."id" = "Copy"."id"
);
