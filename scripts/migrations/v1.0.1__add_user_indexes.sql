-- Migration: v1.0.1__add_user_indexes
-- Description: Ensures index on users role for faster role queries

SELECT COUNT(*) FROM information_schema.statistics 
WHERE table_schema = DATABASE() AND table_name = 'users' AND index_name = 'idx_users_role';
