CREATE DATABASE rtu_dev;
CREATE DATABASE rtu_test;

CREATE USER 'rtu_user'@'localhost' IDENTIFIED BY 'StrongPass123!';
GRANT ALL PRIVILEGES ON rtu_dev.* TO 'rtu_user'@'localhost';
GRANT ALL PRIVILEGES ON rtu_test.* TO 'rtu_user'@'localhost';
FLUSH PRIVILEGES;

select * from user;
use rtu_dev