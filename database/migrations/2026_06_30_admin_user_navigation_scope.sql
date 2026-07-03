USE spc_skillcert_online;

UPDATE admin_navigation_items
SET allowed_roles = 'admin,staff'
WHERE href = '/admin/users';
