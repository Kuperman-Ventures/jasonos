-- Drop the Explore / Consider / Apply subtasks that duplicated list-phase dates.
-- The parent to-do (Develop Your College List) stays.
update college.app_state
set todo_subtasks = todo_subtasks - 'ing-f18927bf-1-qfphn'
where id = 'kyle-college';
