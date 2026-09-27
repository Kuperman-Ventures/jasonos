-- Scoir import: fill empty SAT / platform / essay fields only (2026-09-27).
-- Nested Scoir data lives in data/scoir-import-2026-09-27.json and is overlaid at runtime.
-- Do not overwrite checked test policy, programs, residency, drive, setting, or size.

update college.schools set
  sat_context = case when coalesce(trim(sat_context),'') = '' then '~1500–1570' else sat_context end,
  middle_50 = case when coalesce(trim(middle_50),'') = '' then '~1500–1570' else middle_50 end,
  application_platform = case when coalesce(trim(application_platform),'') = '' then 'Common App' else application_platform end,
  required_essays = case when coalesce(trim(required_essays),'') = '' then 'Required' else required_essays end
where name = 'Carnegie Mellon University (CMU)';

update college.schools set
  sat_context = case when coalesce(trim(sat_context),'') = '' then '~1430–1540' else sat_context end,
  middle_50 = case when coalesce(trim(middle_50),'') = '' then '~1430–1540' else middle_50 end,
  application_platform = case when coalesce(trim(application_platform),'') = '' then 'Common App, Coalition, Scoir' else application_platform end,
  required_essays = case when coalesce(trim(required_essays),'') = '' then 'Required' else required_essays end
where name = 'Case Western Reserve University';

update college.schools set
  sat_context = case when coalesce(trim(sat_context),'') = '' then '~1240–1410' else sat_context end,
  middle_50 = case when coalesce(trim(middle_50),'') = '' then '~1240–1410' else middle_50 end,
  application_platform = case when coalesce(trim(application_platform),'') = '' then 'Common App, Coalition, Scoir' else application_platform end,
  required_essays = case when coalesce(trim(required_essays),'') = '' then 'Optional' else required_essays end
where name = 'Clemson University';

update college.schools set
  sat_context = case when coalesce(trim(sat_context),'') = '' then '~1320–1480' else sat_context end,
  middle_50 = case when coalesce(trim(middle_50),'') = '' then '~1320–1480' else middle_50 end,
  application_platform = case when coalesce(trim(application_platform),'') = '' then 'Common App' else application_platform end
where name = 'Colorado School of Mines';

update college.schools set
  sat_context = case when coalesce(trim(sat_context),'') = '' then '~1500–1570' else sat_context end,
  middle_50 = case when coalesce(trim(middle_50),'') = '' then '~1500–1570' else middle_50 end,
  application_platform = case when coalesce(trim(application_platform),'') = '' then 'Common App' else application_platform end,
  required_essays = case when coalesce(trim(required_essays),'') = '' then 'Required' else required_essays end
where name = 'Cornell University';

update college.schools set
  sat_context = case when coalesce(trim(sat_context),'') = '' then '~1240–1440' else sat_context end,
  middle_50 = case when coalesce(trim(middle_50),'') = '' then '~1240–1440' else middle_50 end,
  application_platform = case when coalesce(trim(application_platform),'') = '' then 'Common App, Coalition, Scoir' else application_platform end,
  required_essays = case when coalesce(trim(required_essays),'') = '' then 'Required' else required_essays end
where name = 'Drexel University';

update college.schools set
  sat_context = case when coalesce(trim(sat_context),'') = '' then '~1370–1540' else sat_context end,
  middle_50 = case when coalesce(trim(middle_50),'') = '' then '~1370–1540' else middle_50 end,
  application_platform = case when coalesce(trim(application_platform),'') = '' then 'Common App' else application_platform end,
  required_essays = case when coalesce(trim(required_essays),'') = '' then 'Required' else required_essays end
where name = 'Georgia Institute of Technology (Georgia Tech)';

update college.schools set
  sat_context = case when coalesce(trim(sat_context),'') = '' then '~1120–1360' else sat_context end,
  middle_50 = case when coalesce(trim(middle_50),'') = '' then '~1120–1360' else middle_50 end,
  application_platform = case when coalesce(trim(application_platform),'') = '' then 'Common App' else application_platform end,
  required_essays = case when coalesce(trim(required_essays),'') = '' then 'Not required' else required_essays end
where name = 'Iowa State University';

update college.schools set
  sat_context = case when coalesce(trim(sat_context),'') = '' then '~1520–1570' else sat_context end,
  middle_50 = case when coalesce(trim(middle_50),'') = '' then '~1520–1570' else middle_50 end,
  application_platform = case when coalesce(trim(application_platform),'') = '' then 'Common App, Coalition, Scoir' else application_platform end,
  required_essays = case when coalesce(trim(required_essays),'') = '' then 'Required' else required_essays end
where name = 'Johns Hopkins University';

update college.schools set
  sat_context = case when coalesce(trim(sat_context),'') = '' then '~1370–1500' else sat_context end,
  middle_50 = case when coalesce(trim(middle_50),'') = '' then '~1370–1500' else middle_50 end,
  application_platform = case when coalesce(trim(application_platform),'') = '' then 'Common App, Coalition, Scoir' else application_platform end,
  required_essays = case when coalesce(trim(required_essays),'') = '' then 'Required' else required_essays end
where name = 'Lehigh University';

update college.schools set
  sat_context = case when coalesce(trim(sat_context),'') = '' then '~1520–1580' else sat_context end,
  middle_50 = case when coalesce(trim(middle_50),'') = '' then '~1520–1580' else middle_50 end,
  application_platform = case when coalesce(trim(application_platform),'') = '' then 'MIT application' else application_platform end,
  required_essays = case when coalesce(trim(required_essays),'') = '' then 'Required' else required_essays end
where name = 'Massachusetts Institute of Technology (MIT)';

update college.schools set
  sat_context = case when coalesce(trim(sat_context),'') = '' then '~1130–1350' else sat_context end,
  middle_50 = case when coalesce(trim(middle_50),'') = '' then '~1130–1350' else middle_50 end,
  application_platform = case when coalesce(trim(application_platform),'') = '' then 'Common App' else application_platform end,
  required_essays = case when coalesce(trim(required_essays),'') = '' then 'Optional' else required_essays end
where name = 'Michigan Technological University (Michigan Tech)';

update college.schools set
  sat_context = case when coalesce(trim(sat_context),'') = '' then '~1210–1460' else sat_context end,
  middle_50 = case when coalesce(trim(middle_50),'') = '' then '~1210–1460' else middle_50 end,
  application_platform = case when coalesce(trim(application_platform),'') = '' then 'Common App' else application_platform end,
  required_essays = case when coalesce(trim(required_essays),'') = '' then 'Required' else required_essays end
where name = 'New Jersey Institute of Technology (NJIT)';

update college.schools set
  sat_context = case when coalesce(trim(sat_context),'') = '' then '~1300–1470' else sat_context end,
  middle_50 = case when coalesce(trim(middle_50),'') = '' then '~1300–1470' else middle_50 end,
  application_platform = case when coalesce(trim(application_platform),'') = '' then 'Common App, Coalition, Scoir' else application_platform end,
  required_essays = case when coalesce(trim(required_essays),'') = '' then 'Required' else required_essays end
where name = 'North Carolina State University (NC State)';

update college.schools set
  sat_context = case when coalesce(trim(sat_context),'') = '' then '~1510–1570' else sat_context end,
  middle_50 = case when coalesce(trim(middle_50),'') = '' then '~1510–1570' else middle_50 end,
  application_platform = case when coalesce(trim(application_platform),'') = '' then 'Common App, Coalition, Scoir' else application_platform end,
  required_essays = case when coalesce(trim(required_essays),'') = '' then 'Optional' else required_essays end
where name = 'Northwestern University';

update college.schools set
  sat_context = case when coalesce(trim(sat_context),'') = '' then '~1310–1480' else sat_context end,
  middle_50 = case when coalesce(trim(middle_50),'') = '' then '~1310–1480' else middle_50 end,
  application_platform = case when coalesce(trim(application_platform),'') = '' then 'Common App' else application_platform end,
  required_essays = case when coalesce(trim(required_essays),'') = '' then 'Required' else required_essays end
where name = 'Ohio State University';

update college.schools set
  sat_context = case when coalesce(trim(sat_context),'') = '' then '~1240–1420' else sat_context end,
  middle_50 = case when coalesce(trim(middle_50),'') = '' then '~1240–1420' else middle_50 end,
  application_platform = case when coalesce(trim(application_platform),'') = '' then 'Common App' else application_platform end,
  required_essays = case when coalesce(trim(required_essays),'') = '' then 'Required for some applicants' else required_essays end
where name = 'Pennsylvania State University (Penn State)';

update college.schools set
  sat_context = case when coalesce(trim(sat_context),'') = '' then '~1200–1480' else sat_context end,
  middle_50 = case when coalesce(trim(middle_50),'') = '' then '~1200–1480' else middle_50 end,
  application_platform = case when coalesce(trim(application_platform),'') = '' then 'Common App' else application_platform end,
  required_essays = case when coalesce(trim(required_essays),'') = '' then 'Required' else required_essays end
where name = 'Purdue University';

update college.schools set
  sat_context = case when coalesce(trim(sat_context),'') = '' then '~1375–1510' else sat_context end,
  middle_50 = case when coalesce(trim(middle_50),'') = '' then '~1375–1510' else middle_50 end,
  application_platform = case when coalesce(trim(application_platform),'') = '' then 'Common App, Coalition' else application_platform end,
  required_essays = case when coalesce(trim(required_essays),'') = '' then 'Required' else required_essays end
where name = 'Rensselaer Polytechnic Institute (RPI)';

update college.schools set
  sat_context = case when coalesce(trim(sat_context),'') = '' then '~1310–1500' else sat_context end,
  middle_50 = case when coalesce(trim(middle_50),'') = '' then '~1310–1500' else middle_50 end,
  application_platform = case when coalesce(trim(application_platform),'') = '' then 'Common App' else application_platform end,
  required_essays = case when coalesce(trim(required_essays),'') = '' then 'Required' else required_essays end
where name = 'Rutgers University–New Brunswick';

update college.schools set
  sat_context = case when coalesce(trim(sat_context),'') = '' then '~1510–1580' else sat_context end,
  middle_50 = case when coalesce(trim(middle_50),'') = '' then '~1510–1580' else middle_50 end,
  application_platform = case when coalesce(trim(application_platform),'') = '' then 'Common App' else application_platform end,
  required_essays = case when coalesce(trim(required_essays),'') = '' then 'Required' else required_essays end
where name = 'Stanford University';

update college.schools set
  sat_context = case when coalesce(trim(sat_context),'') = '' then '~1150–1400' else sat_context end,
  middle_50 = case when coalesce(trim(middle_50),'') = '' then '~1150–1400' else middle_50 end,
  application_platform = case when coalesce(trim(application_platform),'') = '' then 'Common App' else application_platform end,
  required_essays = case when coalesce(trim(required_essays),'') = '' then 'Required' else required_essays end
where name = 'Texas A&M University';

update college.schools set
  application_platform = case when coalesce(trim(application_platform),'') = '' then 'UC Application' else application_platform end,
  required_essays = case when coalesce(trim(required_essays),'') = '' then 'Required' else required_essays end
where name = 'University of California, Berkeley (UC Berkeley)';

update college.schools set
  application_platform = case when coalesce(trim(application_platform),'') = '' then 'UC Application' else application_platform end,
  required_essays = case when coalesce(trim(required_essays),'') = '' then 'Required' else required_essays end
where name = 'University of California, Davis (UC Davis)';

update college.schools set
  application_platform = case when coalesce(trim(application_platform),'') = '' then 'UC Application' else application_platform end,
  required_essays = case when coalesce(trim(required_essays),'') = '' then 'Required' else required_essays end
where name = 'University of California, Irvine (UC Irvine)';

update college.schools set
  application_platform = case when coalesce(trim(application_platform),'') = '' then 'UC Application' else application_platform end,
  required_essays = case when coalesce(trim(required_essays),'') = '' then 'Required' else required_essays end
where name = 'University of California, Los Angeles (UCLA)';

update college.schools set
  sat_context = case when coalesce(trim(sat_context),'') = '' then '~1210–1440' else sat_context end,
  middle_50 = case when coalesce(trim(middle_50),'') = '' then '~1210–1440' else middle_50 end,
  application_platform = case when coalesce(trim(application_platform),'') = '' then 'Common App, Coalition, Scoir' else application_platform end,
  required_essays = case when coalesce(trim(required_essays),'') = '' then 'Required' else required_essays end
where name = 'University of Connecticut (UConn)';

update college.schools set
  sat_context = case when coalesce(trim(sat_context),'') = '' then '~1190–1370' else sat_context end,
  middle_50 = case when coalesce(trim(middle_50),'') = '' then '~1190–1370' else middle_50 end,
  application_platform = case when coalesce(trim(application_platform),'') = '' then 'Common App, Coalition, Scoir' else application_platform end,
  required_essays = case when coalesce(trim(required_essays),'') = '' then 'Required' else required_essays end
where name = 'University of Delaware';

update college.schools set
  sat_context = case when coalesce(trim(sat_context),'') = '' then '~1310–1520' else sat_context end,
  middle_50 = case when coalesce(trim(middle_50),'') = '' then '~1310–1520' else middle_50 end,
  application_platform = case when coalesce(trim(application_platform),'') = '' then 'Common App' else application_platform end,
  required_essays = case when coalesce(trim(required_essays),'') = '' then 'Required' else required_essays end
where name = 'University of Illinois Urbana-Champaign (UIUC)';

update college.schools set
  sat_context = case when coalesce(trim(sat_context),'') = '' then '~1400–1530' else sat_context end,
  middle_50 = case when coalesce(trim(middle_50),'') = '' then '~1400–1530' else middle_50 end,
  application_platform = case when coalesce(trim(application_platform),'') = '' then 'Common App, Coalition' else application_platform end,
  required_essays = case when coalesce(trim(required_essays),'') = '' then 'Required' else required_essays end
where name = 'University of Maryland, College Park';

update college.schools set
  sat_context = case when coalesce(trim(sat_context),'') = '' then '~1360–1530' else sat_context end,
  middle_50 = case when coalesce(trim(middle_50),'') = '' then '~1360–1530' else middle_50 end,
  application_platform = case when coalesce(trim(application_platform),'') = '' then 'Common App' else application_platform end,
  required_essays = case when coalesce(trim(required_essays),'') = '' then 'Required' else required_essays end
where name = 'University of Michigan–Ann Arbor';

update college.schools set
  sat_context = case when coalesce(trim(sat_context),'') = '' then '~1300–1500' else sat_context end,
  middle_50 = case when coalesce(trim(middle_50),'') = '' then '~1300–1500' else middle_50 end,
  application_platform = case when coalesce(trim(application_platform),'') = '' then 'Common App' else application_platform end,
  required_essays = case when coalesce(trim(required_essays),'') = '' then 'Optional' else required_essays end
where name = 'University of Minnesota Twin Cities';

update college.schools set
  sat_context = case when coalesce(trim(sat_context),'') = '' then '~1510–1570' else sat_context end,
  middle_50 = case when coalesce(trim(middle_50),'') = '' then '~1510–1570' else middle_50 end,
  application_platform = case when coalesce(trim(application_platform),'') = '' then 'Common App, Coalition, Scoir' else application_platform end,
  required_essays = case when coalesce(trim(required_essays),'') = '' then 'Required' else required_essays end
where name = 'University of Pennsylvania (UPenn)';

update college.schools set
  sat_context = case when coalesce(trim(sat_context),'') = '' then '~1280–1460' else sat_context end,
  middle_50 = case when coalesce(trim(middle_50),'') = '' then '~1280–1460' else middle_50 end,
  application_platform = case when coalesce(trim(application_platform),'') = '' then 'Common App, Coalition' else application_platform end,
  required_essays = case when coalesce(trim(required_essays),'') = '' then 'Required for some applicants' else required_essays end
where name = 'University of Pittsburgh';

update college.schools set
  sat_context = case when coalesce(trim(sat_context),'') = '' then '~1200–1370' else sat_context end,
  middle_50 = case when coalesce(trim(middle_50),'') = '' then '~1200–1370' else middle_50 end,
  application_platform = case when coalesce(trim(application_platform),'') = '' then 'Common App' else application_platform end,
  required_essays = case when coalesce(trim(required_essays),'') = '' then 'Required' else required_essays end
where name = 'University of Tennessee, Knoxville';

update college.schools set
  sat_context = case when coalesce(trim(sat_context),'') = '' then '~1250–1510' else sat_context end,
  middle_50 = case when coalesce(trim(middle_50),'') = '' then '~1250–1510' else middle_50 end,
  application_platform = case when coalesce(trim(application_platform),'') = '' then 'Common App' else application_platform end,
  required_essays = case when coalesce(trim(required_essays),'') = '' then 'Required' else required_essays end
where name = 'University of Texas at Austin (UT Austin)';

update college.schools set
  sat_context = case when coalesce(trim(sat_context),'') = '' then '~1410–1540' else sat_context end,
  middle_50 = case when coalesce(trim(middle_50),'') = '' then '~1410–1540' else middle_50 end,
  application_platform = case when coalesce(trim(application_platform),'') = '' then 'Common App' else application_platform end,
  required_essays = case when coalesce(trim(required_essays),'') = '' then 'Required' else required_essays end
where name = 'University of Virginia (UVA)';

update college.schools set
  application_platform = case when coalesce(trim(application_platform),'') = '' then 'Common App' else application_platform end,
  required_essays = case when coalesce(trim(required_essays),'') = '' then 'Required' else required_essays end
where name = 'University of Washington';

update college.schools set
  sat_context = case when coalesce(trim(sat_context),'') = '' then '~1380–1520' else sat_context end,
  middle_50 = case when coalesce(trim(middle_50),'') = '' then '~1380–1520' else middle_50 end,
  application_platform = case when coalesce(trim(application_platform),'') = '' then 'Common App' else application_platform end,
  required_essays = case when coalesce(trim(required_essays),'') = '' then 'Required' else required_essays end
where name = 'University of Wisconsin–Madison';

update college.schools set
  sat_context = case when coalesce(trim(sat_context),'') = '' then '~1280–1450' else sat_context end,
  middle_50 = case when coalesce(trim(middle_50),'') = '' then '~1280–1450' else middle_50 end,
  application_platform = case when coalesce(trim(application_platform),'') = '' then 'Common App' else application_platform end
where name = 'Virginia Polytechnic Institute and State University (Virginia Tech)';
