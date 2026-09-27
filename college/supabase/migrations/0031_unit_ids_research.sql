-- Add Scorecard unit IDs and research tracking fields.
alter table college.schools
  add column if not exists unit_id integer,
  add column if not exists research_completed text[] not null default '{}',
  add column if not exists scorecard_fetched_date text not null default '',
  add column if not exists drive_address text not null default '';

create unique index if not exists schools_unit_id_uidx
  on college.schools (unit_id)
  where unit_id is not null;

update college.schools set unit_id = 166683 where name = 'Massachusetts Institute of Technology (MIT)';
update college.schools set unit_id = 243744 where name = 'Stanford University';
update college.schools set unit_id = 110635 where name = 'University of California, Berkeley (UC Berkeley)';
update college.schools set unit_id = 190415 where name = 'Cornell University';
update college.schools set unit_id = 147767 where name = 'Northwestern University';
update college.schools set unit_id = 211440 where name = 'Carnegie Mellon University (CMU)';
update college.schools set unit_id = 215062 where name = 'University of Pennsylvania (UPenn)';
update college.schools set unit_id = 162928 where name = 'Johns Hopkins University';
update college.schools set unit_id = 139755 where name = 'Georgia Institute of Technology (Georgia Tech)';
update college.schools set unit_id = 170976 where name = 'University of Michigan–Ann Arbor';
update college.schools set unit_id = 145637 where name = 'University of Illinois Urbana-Champaign (UIUC)';
update college.schools set unit_id = 228778 where name = 'University of Texas at Austin (UT Austin)';
update college.schools set unit_id = 110662 where name = 'University of California, Los Angeles (UCLA)';
update college.schools set unit_id = 243780 where name = 'Purdue University';
update college.schools set unit_id = 163286 where name = 'University of Maryland, College Park';
update college.schools set unit_id = 236948 where name = 'University of Washington';
update college.schools set unit_id = 240444 where name = 'University of Wisconsin–Madison';
update college.schools set unit_id = 233921 where name = 'Virginia Polytechnic Institute and State University (Virginia Tech)';
update college.schools set unit_id = 214777 where name = 'Pennsylvania State University (Penn State)';
update college.schools set unit_id = 204796 where name = 'Ohio State University';
update college.schools set unit_id = 174066 where name = 'University of Minnesota Twin Cities';
update college.schools set unit_id = 199193 where name = 'North Carolina State University (NC State)';
update college.schools set unit_id = 110644 where name = 'University of California, Davis (UC Davis)';
update college.schools set unit_id = 110653 where name = 'University of California, Irvine (UC Irvine)';
update college.schools set unit_id = 201645 where name = 'Case Western Reserve University';
update college.schools set unit_id = 194824 where name = 'Rensselaer Polytechnic Institute (RPI)';
update college.schools set unit_id = 186380 where name = 'Rutgers University–New Brunswick';
update college.schools set unit_id = 134130 where name = 'University of Florida';
update college.schools set unit_id = 228723 where name = 'Texas A&M University';
update college.schools set unit_id = 126775 where name = 'Colorado School of Mines';
update college.schools set unit_id = 234076 where name = 'University of Virginia (UVA)';
update college.schools set unit_id = 213543 where name = 'Lehigh University';
update college.schools set unit_id = 129020 where name = 'University of Connecticut (UConn)';
update college.schools set unit_id = 130943 where name = 'University of Delaware';
update college.schools set unit_id = 212054 where name = 'Drexel University';
update college.schools set unit_id = 153603 where name = 'Iowa State University';
update college.schools set unit_id = 217882 where name = 'Clemson University';
update college.schools set unit_id = 221759 where name = 'University of Tennessee, Knoxville';
update college.schools set unit_id = 171128 where name = 'Michigan Technological University (Michigan Tech)';
update college.schools set unit_id = 185828 where name = 'New Jersey Institute of Technology (NJIT)';
update college.schools set unit_id = 168421 where name = 'Worcester Polytechnic Institute (WPI)';
update college.schools set unit_id = 186867 where name = 'Stevens Institute of Technology';
update college.schools set unit_id = 152318 where name = 'Rose-Hulman Institute of Technology';
update college.schools set unit_id = 197133 where name = 'Vassar College';
update college.schools set unit_id = 215293 where name = 'University of Pittsburgh';

-- Existing schools already have Setting / Programs / residency research from prior imports.
update college.schools set research_completed = array(
  select distinct g from unnest(
    coalesce(research_completed, '{}'::text[]) ||
    array['Setting','Programs','Admissions by residency'] ||
    case
      when coalesce(test_policy,'') <> '' then array['Application requirements']
      else '{}'::text[]
    end ||
    case
      when coalesce(merit_aid_notes,'') <> '' then array['Aid']
      else '{}'::text[]
    end
  ) as g
);