-- Revert Scoir 0033 leftovers that overwrote empty fields with Scoir-only values.
-- Leaves application_platform, sat_context, and all other columns alone.

update college.schools
set middle_50 = ''
where name = 'University of Maryland, College Park'
  and middle_50 = '~1400–1530';

update college.schools
set middle_50 = ''
where name = 'University of Tennessee, Knoxville'
  and middle_50 = '~1200–1370';

update college.schools
set required_essays = ''
where required_essays = 'Required'
  and name in (
    'Massachusetts Institute of Technology (MIT)',
    'University of California, Berkeley (UC Berkeley)',
    'University of California, Davis (UC Davis)',
    'University of California, Irvine (UC Irvine)',
    'University of California, Los Angeles (UCLA)'
  );
