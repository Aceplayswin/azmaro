-- Save the delivery addresses of past orders into each signed-in customer's
-- address book (one per street + PIN, from the most recent order), make the
-- newest one the default where a customer has none, and fill empty account
-- phone numbers from their latest order. New orders do this automatically.

INSERT INTO `addresses` (`id`, `userId`, `label`, `fullName`, `phone`, `line1`, `line2`, `landmark`, `city`, `state`, `pin`, `isDefault`, `createdAt`)
SELECT CONCAT('c', LEFT(REPLACE(UUID(), '-', ''), 24)),
       o.`userId`, NULL, o.`shipName`, o.`shipPhone`, o.`shipLine1`, o.`shipLine2`, o.`shipLandmark`, o.`shipCity`, o.`shipState`, o.`shipPin`,
       false, o.`createdAt`
FROM `orders` o
WHERE o.`userId` IS NOT NULL
  AND o.`id` = (
    SELECT o2.`id` FROM `orders` o2
    WHERE o2.`userId` = o.`userId` AND LOWER(TRIM(o2.`shipLine1`)) = LOWER(TRIM(o.`shipLine1`)) AND o2.`shipPin` = o.`shipPin`
    ORDER BY o2.`createdAt` DESC, o2.`id` DESC LIMIT 1
  )
  AND NOT EXISTS (
    SELECT 1 FROM `addresses` a
    WHERE a.`userId` = o.`userId` AND LOWER(TRIM(a.`line1`)) = LOWER(TRIM(o.`shipLine1`)) AND a.`pin` = o.`shipPin`
  );

UPDATE `addresses` a
JOIN (
  SELECT a2.`userId`, SUBSTRING_INDEX(GROUP_CONCAT(a2.`id` ORDER BY a2.`createdAt` DESC, a2.`id` DESC), ',', 1) AS `newest`
  FROM `addresses` a2
  GROUP BY a2.`userId`
  HAVING SUM(a2.`isDefault`) = 0
) d ON d.`newest` = a.`id`
SET a.`isDefault` = true;

UPDATE `users` u
JOIN (
  SELECT o.`userId`, SUBSTRING_INDEX(GROUP_CONCAT(o.`phone` ORDER BY o.`createdAt` DESC, o.`id` DESC), ',', 1) AS `phone`
  FROM `orders` o
  WHERE o.`userId` IS NOT NULL
  GROUP BY o.`userId`
) p ON p.`userId` = u.`id`
SET u.`phone` = p.`phone`
WHERE u.`phone` IS NULL OR u.`phone` = '';
