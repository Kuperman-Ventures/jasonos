-- Aerospace engineering + materials program fields and catalog-checked values.
alter table college.schools
  add column if not exists materials_program text not null default '',
  add column if not exists materials_source_url text not null default '',
  add column if not exists aerospace_engineering text not null default '',
  add column if not exists aerospace_program text not null default '',
  add column if not exists aerospace_notes text not null default '',
  add column if not exists aerospace_source_url text not null default '';

update college.schools set
  materials = 'Yes',
  materials_offering = 'Standalone undergraduate',
  materials_program = 'Materials Science and Engineering (SB, Course 3)',
  materials_source_url = 'https://catalog.mit.edu/degree-charts/',
  aerospace_engineering = 'Yes',
  aerospace_program = 'Aerospace Engineering (SB, Course 16)',
  aerospace_notes = 'Offered by the Department of Aeronautics and Astronautics.',
  aerospace_source_url = 'https://catalog.mit.edu/degree-charts/',
  tracked_programs = case
    when tracked_programs is null or tracked_programs = '[]'::jsonb
      then '["Mechanical engineering","Material sciences","Aerospace engineering"]'::jsonb
    when tracked_programs @> '["Aerospace engineering"]'::jsonb
      then tracked_programs
    else tracked_programs || '["Aerospace engineering"]'::jsonb
  end,
  updated_at = now()
where name = 'Massachusetts Institute of Technology (MIT)';

update college.schools set
  materials = 'Yes',
  materials_offering = 'Standalone undergraduate',
  materials_program = 'Materials Science and Engineering (BS)',
  materials_source_url = 'https://majors.stanford.edu/majors/materials-science-and-engineering',
  aerospace_engineering = 'Yes',
  aerospace_program = 'Aeronautics and Astronautics (BS)',
  aerospace_notes = 'The diploma reads Bachelor of Science in Engineering, with Aeronautics and Astronautics named as the program.',
  aerospace_source_url = 'https://bulletin.stanford.edu/programs/AA-BS',
  tracked_programs = case
    when tracked_programs is null or tracked_programs = '[]'::jsonb
      then '["Mechanical engineering","Material sciences","Aerospace engineering"]'::jsonb
    when tracked_programs @> '["Aerospace engineering"]'::jsonb
      then tracked_programs
    else tracked_programs || '["Aerospace engineering"]'::jsonb
  end,
  updated_at = now()
where name = 'Stanford University';

update college.schools set
  materials = 'Yes',
  materials_offering = 'Standalone undergraduate',
  materials_program = 'Materials Science and Engineering (BS)',
  materials_source_url = 'https://engineering.berkeley.edu/admissions/undergraduate-admissions/undergraduate-academic-programs/',
  aerospace_engineering = 'Yes',
  aerospace_program = 'BS in Aerospace Engineering',
  aerospace_notes = 'New major (first freshman class Fall 2022); applicants choose the major on the application.',
  aerospace_source_url = 'https://engineering.berkeley.edu/academics/undergraduate-programs/aerospace-engineering/',
  tracked_programs = case
    when tracked_programs is null or tracked_programs = '[]'::jsonb
      then '["Mechanical engineering","Material sciences","Aerospace engineering"]'::jsonb
    when tracked_programs @> '["Aerospace engineering"]'::jsonb
      then tracked_programs
    else tracked_programs || '["Aerospace engineering"]'::jsonb
  end,
  updated_at = now()
where name = 'University of California, Berkeley (UC Berkeley)';

update college.schools set
  materials = 'Yes',
  materials_offering = 'Standalone undergraduate',
  materials_program = 'Materials Science and Engineering (BS)',
  materials_source_url = 'https://catalog.cornell.edu/programs/materials-science-engineering-bs/',
  aerospace_engineering = 'Partial',
  aerospace_program = 'Aerospace Engineering Minor',
  aerospace_notes = 'The department is named Mechanical and Aerospace Engineering, but the only undergraduate major is Mechanical Engineering.',
  aerospace_source_url = 'https://courses.cornell.edu/programs/aerospace-engineering-minor/',
  tracked_programs = case
    when tracked_programs is null or tracked_programs = '[]'::jsonb
      then '["Mechanical engineering","Material sciences","Aerospace engineering"]'::jsonb
    when tracked_programs @> '["Aerospace engineering"]'::jsonb
      then tracked_programs
    else tracked_programs || '["Aerospace engineering"]'::jsonb
  end,
  updated_at = now()
where name = 'Cornell University';

update college.schools set
  materials = 'Yes',
  materials_offering = 'Standalone undergraduate',
  materials_program = 'Materials Science and Engineering (BS)',
  materials_source_url = 'https://www.mccormick.northwestern.edu/materials-science/academics/undergraduate/bachelor-of-science/',
  aerospace_engineering = 'Partial',
  aerospace_program = 'Space Engineering Certificate',
  aerospace_notes = 'No aerospace major, minor or concentration; the only aerospace-specific option is an undergraduate certificate.',
  aerospace_source_url = 'https://catalogs.northwestern.edu/undergraduate/engineering-applied-science/space-engineering/space-engineering-certificate/',
  tracked_programs = case
    when tracked_programs is null or tracked_programs = '[]'::jsonb
      then '["Mechanical engineering","Material sciences","Aerospace engineering"]'::jsonb
    when tracked_programs @> '["Aerospace engineering"]'::jsonb
      then tracked_programs
    else tracked_programs || '["Aerospace engineering"]'::jsonb
  end,
  updated_at = now()
where name = 'Northwestern University';

update college.schools set
  materials = 'Yes',
  materials_offering = 'Standalone undergraduate',
  materials_program = 'Materials Science and Engineering (BS)',
  materials_source_url = 'https://coursecatalog.web.cmu.edu/degreesoffered/',
  aerospace_engineering = 'No',
  aerospace_program = '',
  aerospace_notes = 'The catalog lists no aerospace major, track or minor.',
  aerospace_source_url = 'https://coursecatalog.web.cmu.edu/schools-colleges/collegeofengineering/departmentofmechanicalengineering/',
  tracked_programs = case
    when tracked_programs is null or tracked_programs = '[]'::jsonb
      then '["Mechanical engineering","Material sciences","Aerospace engineering"]'::jsonb
    when tracked_programs @> '["Aerospace engineering"]'::jsonb
      then tracked_programs
    else tracked_programs || '["Aerospace engineering"]'::jsonb
  end,
  updated_at = now()
where name = 'Carnegie Mellon University (CMU)';

update college.schools set
  materials = 'Yes',
  materials_offering = 'Standalone undergraduate',
  materials_program = 'Materials Science and Engineering (BSE)',
  materials_source_url = 'https://catalog.upenn.edu/undergraduate/programs/materials-science-engineering-bse/',
  aerospace_engineering = 'No',
  aerospace_program = '',
  aerospace_notes = 'None of the four Mechanical Engineering concentrations is aerospace.',
  aerospace_source_url = 'https://catalog.upenn.edu/undergraduate/programs/mechanical-engineering-applied-mechanics-bse/',
  tracked_programs = case
    when tracked_programs is null or tracked_programs = '[]'::jsonb
      then '["Mechanical engineering","Material sciences","Aerospace engineering"]'::jsonb
    when tracked_programs @> '["Aerospace engineering"]'::jsonb
      then tracked_programs
    else tracked_programs || '["Aerospace engineering"]'::jsonb
  end,
  updated_at = now()
where name = 'University of Pennsylvania (UPenn)';

update college.schools set
  materials = 'Yes',
  materials_offering = 'Standalone undergraduate',
  materials_program = 'Materials Science and Engineering (BS)',
  materials_source_url = 'https://e-catalogue.jhu.edu/engineering/full-time-residential-programs/degree-programs/materials-science-engineering/materials-engineering-bachelor-science/',
  aerospace_engineering = 'Partial',
  aerospace_program = 'Aerospace Engineering track within Mechanical Engineering; Space Science and Engineering Minor',
  aerospace_notes = 'The aerospace track is a formal track inside the Mechanical Engineering major, not a separate degree.',
  aerospace_source_url = 'https://engineering.jhu.edu/ug-academic/advising/eng-101/programs/meche/',
  tracked_programs = case
    when tracked_programs is null or tracked_programs = '[]'::jsonb
      then '["Mechanical engineering","Material sciences","Aerospace engineering"]'::jsonb
    when tracked_programs @> '["Aerospace engineering"]'::jsonb
      then tracked_programs
    else tracked_programs || '["Aerospace engineering"]'::jsonb
  end,
  updated_at = now()
where name = 'Johns Hopkins University';

update college.schools set
  materials = 'Yes',
  materials_offering = 'Standalone undergraduate',
  materials_program = 'Materials Science and Engineering (BS)',
  materials_source_url = 'https://catalog.gatech.edu/colleges/coe/materials-science/',
  aerospace_engineering = 'Yes',
  aerospace_program = 'BS in Aerospace Engineering',
  aerospace_notes = 'Offered by its own school (Guggenheim School of Aerospace Engineering).',
  aerospace_source_url = 'https://catalog.gatech.edu/programs/aerospace-engineering-bs/',
  tracked_programs = case
    when tracked_programs is null or tracked_programs = '[]'::jsonb
      then '["Mechanical engineering","Material sciences","Aerospace engineering"]'::jsonb
    when tracked_programs @> '["Aerospace engineering"]'::jsonb
      then tracked_programs
    else tracked_programs || '["Aerospace engineering"]'::jsonb
  end,
  updated_at = now()
where name = 'Georgia Institute of Technology (Georgia Tech)';

update college.schools set
  materials = 'Yes',
  materials_offering = 'Standalone undergraduate',
  materials_program = 'Materials Science and Engineering (BSE)',
  materials_source_url = 'https://bulletin.engin.umich.edu/ug-ed/degrees/',
  aerospace_engineering = 'Yes',
  aerospace_program = 'BSE in Aerospace Engineering',
  aerospace_notes = 'Students enter engineering undeclared and choose a major by the third term; a separate BSE in Space Science and Engineering also exists.',
  aerospace_source_url = 'https://bulletin.engin.umich.edu/ug-ed/degrees/',
  tracked_programs = case
    when tracked_programs is null or tracked_programs = '[]'::jsonb
      then '["Mechanical engineering","Material sciences","Aerospace engineering"]'::jsonb
    when tracked_programs @> '["Aerospace engineering"]'::jsonb
      then tracked_programs
    else tracked_programs || '["Aerospace engineering"]'::jsonb
  end,
  updated_at = now()
where name = 'University of Michigan–Ann Arbor';

update college.schools set
  materials = 'Yes',
  materials_offering = 'Standalone undergraduate',
  materials_program = 'Materials Science and Engineering (BS); also MSE + Data Science (BS)',
  materials_source_url = 'https://catalog.illinois.edu/schools/engineering/',
  aerospace_engineering = 'Yes',
  aerospace_program = 'BS in Aerospace Engineering',
  aerospace_notes = 'A combined BS-MS is also offered.',
  aerospace_source_url = 'https://catalog.illinois.edu/undergraduate/engineering/aerospace-engineering-bs/',
  tracked_programs = case
    when tracked_programs is null or tracked_programs = '[]'::jsonb
      then '["Mechanical engineering","Material sciences","Aerospace engineering"]'::jsonb
    when tracked_programs @> '["Aerospace engineering"]'::jsonb
      then tracked_programs
    else tracked_programs || '["Aerospace engineering"]'::jsonb
  end,
  updated_at = now()
where name = 'University of Illinois Urbana-Champaign (UIUC)';

update college.schools set
  materials = 'Yes',
  materials_offering = 'Standalone undergraduate',
  materials_program = 'Materials Science and Engineering (BS) - new, first class Fall 2027',
  materials_source_url = 'https://news.utexas.edu/2026/08/03/ut-launches-new-materials-science-bachelors-program/',
  aerospace_engineering = 'Yes',
  aerospace_program = 'BS in Aerospace Engineering',
  aerospace_notes = 'Offered by the Department of Aerospace Engineering and Engineering Mechanics.',
  aerospace_source_url = 'https://catalog.utexas.edu/undergraduate/programs/aerospace-engineering-bsase/',
  tracked_programs = case
    when tracked_programs is null or tracked_programs = '[]'::jsonb
      then '["Mechanical engineering","Material sciences","Aerospace engineering"]'::jsonb
    when tracked_programs @> '["Aerospace engineering"]'::jsonb
      then tracked_programs
    else tracked_programs || '["Aerospace engineering"]'::jsonb
  end,
  updated_at = now()
where name = 'University of Texas at Austin (UT Austin)';

update college.schools set
  materials = 'Yes',
  materials_offering = 'Standalone undergraduate',
  materials_program = 'Materials Engineering (BS)',
  materials_source_url = 'https://catalog.registrar.ucla.edu/major/2025/materialsengineeringbs',
  aerospace_engineering = 'Yes',
  aerospace_program = 'BS in Aerospace Engineering',
  aerospace_notes = 'Offered by the Mechanical and Aerospace Engineering department.',
  aerospace_source_url = 'https://catalog.registrar.ucla.edu/major/2021/aerospaceengineeringbs?siteYear=2021',
  tracked_programs = case
    when tracked_programs is null or tracked_programs = '[]'::jsonb
      then '["Mechanical engineering","Material sciences","Aerospace engineering"]'::jsonb
    when tracked_programs @> '["Aerospace engineering"]'::jsonb
      then tracked_programs
    else tracked_programs || '["Aerospace engineering"]'::jsonb
  end,
  updated_at = now()
where name = 'University of California, Los Angeles (UCLA)';

update college.schools set
  materials = 'Yes',
  materials_offering = 'Standalone undergraduate',
  materials_program = 'Materials Engineering (BSMSE)',
  materials_source_url = 'https://catalog.purdue.edu/preview_program.php?catoid=17&poid=29737',
  aerospace_engineering = 'Yes',
  aerospace_program = 'BS in Aeronautical and Astronautical Engineering',
  aerospace_notes = 'Offered by its own School of Aeronautics and Astronautics; students choose it after First-Year Engineering.',
  aerospace_source_url = 'https://catalog.purdue.edu/preview_program.php?catoid=18&poid=32503',
  tracked_programs = case
    when tracked_programs is null or tracked_programs = '[]'::jsonb
      then '["Mechanical engineering","Material sciences","Aerospace engineering"]'::jsonb
    when tracked_programs @> '["Aerospace engineering"]'::jsonb
      then tracked_programs
    else tracked_programs || '["Aerospace engineering"]'::jsonb
  end,
  updated_at = now()
where name = 'Purdue University';

update college.schools set
  materials = 'Yes',
  materials_offering = 'Standalone undergraduate',
  materials_program = 'Materials Science and Engineering (BS)',
  materials_source_url = 'https://academiccatalog.umd.edu/undergraduate/colleges-schools/engineering/materials-science-engineering/materials-science-engineering-major/',
  aerospace_engineering = 'Yes',
  aerospace_program = 'BS in Aerospace Engineering',
  aerospace_notes = 'Offered by its own Department of Aerospace Engineering.',
  aerospace_source_url = 'https://academiccatalog.umd.edu/undergraduate/colleges-schools/engineering/aerospace-engineering/aerospace-engineering-major/',
  tracked_programs = case
    when tracked_programs is null or tracked_programs = '[]'::jsonb
      then '["Mechanical engineering","Material sciences","Aerospace engineering"]'::jsonb
    when tracked_programs @> '["Aerospace engineering"]'::jsonb
      then tracked_programs
    else tracked_programs || '["Aerospace engineering"]'::jsonb
  end,
  updated_at = now()
where name = 'University of Maryland, College Park';

update college.schools set
  materials = 'Yes',
  materials_offering = 'Standalone undergraduate',
  materials_program = 'Materials Science and Engineering (BS)',
  materials_source_url = 'https://mse.washington.edu/current/undergrad/courses',
  aerospace_engineering = 'Yes',
  aerospace_program = 'BS in Aeronautics and Astronautics',
  aerospace_notes = 'Offered by the William E. Boeing Department of Aeronautics and Astronautics.',
  aerospace_source_url = 'https://www.aa.washington.edu/students/academics/bsaae',
  tracked_programs = case
    when tracked_programs is null or tracked_programs = '[]'::jsonb
      then '["Mechanical engineering","Material sciences","Aerospace engineering"]'::jsonb
    when tracked_programs @> '["Aerospace engineering"]'::jsonb
      then tracked_programs
    else tracked_programs || '["Aerospace engineering"]'::jsonb
  end,
  updated_at = now()
where name = 'University of Washington';

update college.schools set
  materials = 'Yes',
  materials_offering = 'Standalone undergraduate',
  materials_program = 'Materials Science and Engineering (BS)',
  materials_source_url = 'https://guide.wisc.edu/undergraduate/engineering/materials-science-engineering/materials-science-engineering-bs/',
  aerospace_engineering = 'Yes',
  aerospace_program = 'BS in Aerospace Engineering',
  aerospace_notes = 'New major approved February 2026, first enrolling Fall 2026, run by the Mechanical Engineering department.',
  aerospace_source_url = 'https://engineering.wisc.edu/news/regents-approve-new-aerospace-engineering-major/',
  tracked_programs = case
    when tracked_programs is null or tracked_programs = '[]'::jsonb
      then '["Mechanical engineering","Material sciences","Aerospace engineering"]'::jsonb
    when tracked_programs @> '["Aerospace engineering"]'::jsonb
      then tracked_programs
    else tracked_programs || '["Aerospace engineering"]'::jsonb
  end,
  updated_at = now()
where name = 'University of Wisconsin–Madison';

update college.schools set
  materials = 'Yes',
  materials_offering = 'Standalone undergraduate',
  materials_program = 'Materials Science and Engineering (BS)',
  materials_source_url = 'https://catalog.vt.edu/undergraduate/college-engineering/materials-science-engineering/materials-science-engineering-bs/',
  aerospace_engineering = 'Yes',
  aerospace_program = 'BS in Aerospace Engineering',
  aerospace_notes = 'Offered by the Aerospace and Ocean Engineering department.',
  aerospace_source_url = 'https://catalog.vt.edu/undergraduate/college-engineering/aerospace-ocean-engineering/aerospace-engineering-bs/',
  tracked_programs = case
    when tracked_programs is null or tracked_programs = '[]'::jsonb
      then '["Mechanical engineering","Material sciences","Aerospace engineering"]'::jsonb
    when tracked_programs @> '["Aerospace engineering"]'::jsonb
      then tracked_programs
    else tracked_programs || '["Aerospace engineering"]'::jsonb
  end,
  updated_at = now()
where name = 'Virginia Polytechnic Institute and State University (Virginia Tech)';

update college.schools set
  materials = 'Yes',
  materials_offering = 'Standalone undergraduate',
  materials_program = 'Materials Science and Engineering (BS)',
  materials_source_url = 'https://bulletins.psu.edu/undergraduate/colleges/earth-mineral-sciences/materials-science-engineering-bs/',
  aerospace_engineering = 'Yes',
  aerospace_program = 'BS in Aerospace Engineering',
  aerospace_notes = 'Offered by its own Department of Aerospace Engineering.',
  aerospace_source_url = 'https://bulletins.psu.edu/undergraduate/colleges/engineering/aerospace-engineering-bs/',
  tracked_programs = case
    when tracked_programs is null or tracked_programs = '[]'::jsonb
      then '["Mechanical engineering","Material sciences","Aerospace engineering"]'::jsonb
    when tracked_programs @> '["Aerospace engineering"]'::jsonb
      then tracked_programs
    else tracked_programs || '["Aerospace engineering"]'::jsonb
  end,
  updated_at = now()
where name = 'Pennsylvania State University (Penn State)';

update college.schools set
  materials = 'Yes',
  materials_offering = 'Standalone undergraduate',
  materials_program = 'Materials Science and Engineering (BS)',
  materials_source_url = 'https://engineering.osu.edu/bachelor-science-materials-science-and-engineering',
  aerospace_engineering = 'Yes',
  aerospace_program = 'BS in Aerospace Engineering',
  aerospace_notes = 'Offered by the Mechanical and Aerospace Engineering department; students apply to the major after enrolling.',
  aerospace_source_url = 'https://engineering.osu.edu/bachelor-science-aerospace-engineering',
  tracked_programs = case
    when tracked_programs is null or tracked_programs = '[]'::jsonb
      then '["Mechanical engineering","Material sciences","Aerospace engineering"]'::jsonb
    when tracked_programs @> '["Aerospace engineering"]'::jsonb
      then tracked_programs
    else tracked_programs || '["Aerospace engineering"]'::jsonb
  end,
  updated_at = now()
where name = 'Ohio State University';

update college.schools set
  materials = 'Yes',
  materials_offering = 'Standalone undergraduate',
  materials_program = 'Bachelor of Materials Science and Engineering (BMatSE)',
  materials_source_url = 'https://cse.umn.edu/cems/bachelor-materials-science-and-engineering',
  aerospace_engineering = 'Yes',
  aerospace_program = 'Bachelor of Aerospace Engineering and Mechanics (BAEM)',
  aerospace_notes = 'Offered by the Department of Aerospace Engineering and Mechanics.',
  aerospace_source_url = 'https://onestop2.umn.edu/pcas/viewCatalogProgram.do?programID=2&strm=1243&campus=UMNTC',
  tracked_programs = case
    when tracked_programs is null or tracked_programs = '[]'::jsonb
      then '["Mechanical engineering","Material sciences","Aerospace engineering"]'::jsonb
    when tracked_programs @> '["Aerospace engineering"]'::jsonb
      then tracked_programs
    else tracked_programs || '["Aerospace engineering"]'::jsonb
  end,
  updated_at = now()
where name = 'University of Minnesota Twin Cities';

update college.schools set
  materials = 'Yes',
  materials_offering = 'Standalone undergraduate',
  materials_program = 'Materials Science and Engineering (BS)',
  materials_source_url = 'https://catalog.ncsu.edu/undergraduate/engineering/materials-science-engineering/materials-science-engineering-bs/',
  aerospace_engineering = 'Yes',
  aerospace_program = 'BS in Aerospace Engineering',
  aerospace_notes = 'Offered by the Mechanical and Aerospace Engineering department.',
  aerospace_source_url = 'https://catalog.ncsu.edu/undergraduate/engineering/mechanical-aerospace/aerospace-engineering-bs/',
  tracked_programs = case
    when tracked_programs is null or tracked_programs = '[]'::jsonb
      then '["Mechanical engineering","Material sciences","Aerospace engineering"]'::jsonb
    when tracked_programs @> '["Aerospace engineering"]'::jsonb
      then tracked_programs
    else tracked_programs || '["Aerospace engineering"]'::jsonb
  end,
  updated_at = now()
where name = 'North Carolina State University (NC State)';

update college.schools set
  materials = 'Yes',
  materials_offering = 'Standalone undergraduate',
  materials_program = 'Materials Science and Engineering (BS)',
  materials_source_url = 'https://catalog.ucdavis.edu/departments-programs-degrees/materials-science-engineering/materials-science-engineering-bs/',
  aerospace_engineering = 'Yes',
  aerospace_program = 'BS in Aerospace Science and Engineering',
  aerospace_notes = 'Offered by the Mechanical and Aerospace Engineering department.',
  aerospace_source_url = 'https://catalog.ucdavis.edu/departments-programs-degrees/mechanical-aerospace-engineering/aerospace-science-engineering-bs/',
  tracked_programs = case
    when tracked_programs is null or tracked_programs = '[]'::jsonb
      then '["Mechanical engineering","Material sciences","Aerospace engineering"]'::jsonb
    when tracked_programs @> '["Aerospace engineering"]'::jsonb
      then tracked_programs
    else tracked_programs || '["Aerospace engineering"]'::jsonb
  end,
  updated_at = now()
where name = 'University of California, Davis (UC Davis)';

update college.schools set
  materials = 'Yes',
  materials_offering = 'Standalone undergraduate',
  materials_program = 'Materials Science and Engineering (BS)',
  materials_source_url = 'https://catalogue.uci.edu/thehenrysamuelischoolofengineering/departmentofmaterialsscienceandengineering/',
  aerospace_engineering = 'Yes',
  aerospace_program = 'BS in Aerospace Engineering',
  aerospace_notes = 'Offered by the Mechanical and Aerospace Engineering department.',
  aerospace_source_url = 'https://catalogue.uci.edu/thehenrysamuelischoolofengineering/departmentofmechanicalandaerospaceengineering/aerospaceengineering_bs/',
  tracked_programs = case
    when tracked_programs is null or tracked_programs = '[]'::jsonb
      then '["Mechanical engineering","Material sciences","Aerospace engineering"]'::jsonb
    when tracked_programs @> '["Aerospace engineering"]'::jsonb
      then tracked_programs
    else tracked_programs || '["Aerospace engineering"]'::jsonb
  end,
  updated_at = now()
where name = 'University of California, Irvine (UC Irvine)';

update college.schools set
  materials = 'Yes',
  materials_offering = 'Standalone undergraduate',
  materials_program = 'Materials Science and Engineering (BSE)',
  materials_source_url = 'https://bulletin.case.edu/engineering/materials-science-engineering/materials-science-engineering-bse/',
  aerospace_engineering = 'Yes',
  aerospace_program = 'BSE in Aerospace Engineering',
  aerospace_notes = 'Offered by the Mechanical and Aerospace Engineering department.',
  aerospace_source_url = 'https://bulletin.case.edu/engineering/mechanical-aerospace-engineering/aerospace-engineering-bse/',
  tracked_programs = case
    when tracked_programs is null or tracked_programs = '[]'::jsonb
      then '["Mechanical engineering","Material sciences","Aerospace engineering"]'::jsonb
    when tracked_programs @> '["Aerospace engineering"]'::jsonb
      then tracked_programs
    else tracked_programs || '["Aerospace engineering"]'::jsonb
  end,
  updated_at = now()
where name = 'Case Western Reserve University';

update college.schools set
  materials = 'Yes',
  materials_offering = 'Standalone undergraduate',
  materials_program = 'Materials Engineering (BS)',
  materials_source_url = 'https://catalog.rpi.edu/preview_program.php?catoid=33&poid=9566',
  aerospace_engineering = 'Yes',
  aerospace_program = 'BS in Aerospace Engineering (department also lists BS in Aeronautical Engineering)',
  aerospace_notes = 'RPI also offers dual BS programs combining aerospace or aeronautical with mechanical engineering.',
  aerospace_source_url = 'https://mane.rpi.edu/programs/aerospace-engineering-b-s',
  tracked_programs = case
    when tracked_programs is null or tracked_programs = '[]'::jsonb
      then '["Mechanical engineering","Material sciences","Aerospace engineering"]'::jsonb
    when tracked_programs @> '["Aerospace engineering"]'::jsonb
      then tracked_programs
    else tracked_programs || '["Aerospace engineering"]'::jsonb
  end,
  updated_at = now()
where name = 'Rensselaer Polytechnic Institute (RPI)';

update college.schools set
  materials = 'Yes',
  materials_offering = 'Standalone undergraduate',
  materials_program = 'Materials Science and Engineering (BS)',
  materials_source_url = 'https://soe.rutgers.edu/academics/majors-and-areas-study/materials-science-and-engineering',
  aerospace_engineering = 'Yes',
  aerospace_program = 'BS in Aerospace Engineering',
  aerospace_notes = 'The only public university in New Jersey with an aerospace engineering degree; a 5-year BS/MS is also offered.',
  aerospace_source_url = 'https://mae.rutgers.edu/admissions/undergraduate-program/aerospace-engineering',
  tracked_programs = case
    when tracked_programs is null or tracked_programs = '[]'::jsonb
      then '["Mechanical engineering","Material sciences","Aerospace engineering"]'::jsonb
    when tracked_programs @> '["Aerospace engineering"]'::jsonb
      then tracked_programs
    else tracked_programs || '["Aerospace engineering"]'::jsonb
  end,
  updated_at = now()
where name = 'Rutgers University–New Brunswick';

update college.schools set
  materials = 'Yes',
  materials_offering = 'Standalone undergraduate',
  materials_program = 'Materials Science and Engineering (BSMS)',
  materials_source_url = 'https://catalog.ufl.edu/UGRD/colleges-schools/UGENG/MSE_BSMS/',
  aerospace_engineering = 'Yes',
  aerospace_program = 'BS in Aerospace Engineering',
  aerospace_notes = 'Offered by the Mechanical and Aerospace Engineering department.',
  aerospace_source_url = 'https://catalog.ufl.edu/UGRD/colleges-schools/UGENG/ARO_BSAE/',
  tracked_programs = case
    when tracked_programs is null or tracked_programs = '[]'::jsonb
      then '["Mechanical engineering","Material sciences","Aerospace engineering"]'::jsonb
    when tracked_programs @> '["Aerospace engineering"]'::jsonb
      then tracked_programs
    else tracked_programs || '["Aerospace engineering"]'::jsonb
  end,
  updated_at = now()
where name = 'University of Florida';

update college.schools set
  materials = 'Yes',
  materials_offering = 'Standalone undergraduate',
  materials_program = 'Materials Science and Engineering (BS)',
  materials_source_url = 'https://catalog.tamu.edu/undergraduate/engineering/materials-science/bs/',
  aerospace_engineering = 'Yes',
  aerospace_program = 'BS in Aerospace Engineering',
  aerospace_notes = 'The 2026-27 catalog also lists a separate BS in Space Engineering in the same department.',
  aerospace_source_url = 'https://catalog.tamu.edu/undergraduate/engineering/aerospace/bs/',
  tracked_programs = case
    when tracked_programs is null or tracked_programs = '[]'::jsonb
      then '["Mechanical engineering","Material sciences","Aerospace engineering"]'::jsonb
    when tracked_programs @> '["Aerospace engineering"]'::jsonb
      then tracked_programs
    else tracked_programs || '["Aerospace engineering"]'::jsonb
  end,
  updated_at = now()
where name = 'Texas A&M University';

update college.schools set
  materials = 'Yes',
  materials_offering = 'Standalone materials/metallurgical',
  materials_program = 'Metallurgical and Materials Engineering (BS)',
  materials_source_url = 'https://catalog.mines.edu/undergraduate/academics/degrees/',
  aerospace_engineering = 'Partial',
  aerospace_program = 'Aerospace Engineering Minor; Aerospace track within Mechanical Engineering',
  aerospace_notes = 'No aerospace degree among the school''s 21 undergraduate degrees.',
  aerospace_source_url = 'https://www.mines.edu/academics/program/minor-aerospace-engineering/',
  tracked_programs = case
    when tracked_programs is null or tracked_programs = '[]'::jsonb
      then '["Mechanical engineering","Material sciences","Aerospace engineering"]'::jsonb
    when tracked_programs @> '["Aerospace engineering"]'::jsonb
      then tracked_programs
    else tracked_programs || '["Aerospace engineering"]'::jsonb
  end,
  updated_at = now()
where name = 'Colorado School of Mines';

update college.schools set
  materials = 'Yes',
  materials_offering = 'Standalone undergraduate',
  materials_program = 'Materials Science and Engineering (BS)',
  materials_source_url = 'https://engineering.virginia.edu/department/materials-science-and-engineering/academics/undergraduate-programs/bs-materials-science-and-engineering',
  aerospace_engineering = 'Yes',
  aerospace_program = 'BS in Aerospace Engineering',
  aerospace_notes = 'Offered by the Mechanical and Aerospace Engineering department.',
  aerospace_source_url = 'https://engineering.virginia.edu/department/mechanical-and-aerospace-engineering/academics/aerospace-engineering-undergraduate-program/bs-aerospace-engineering',
  tracked_programs = case
    when tracked_programs is null or tracked_programs = '[]'::jsonb
      then '["Mechanical engineering","Material sciences","Aerospace engineering"]'::jsonb
    when tracked_programs @> '["Aerospace engineering"]'::jsonb
      then tracked_programs
    else tracked_programs || '["Aerospace engineering"]'::jsonb
  end,
  updated_at = now()
where name = 'University of Virginia (UVA)';

update college.schools set
  materials = 'Yes',
  materials_offering = 'Standalone undergraduate',
  materials_program = 'Materials Science and Engineering (BS)',
  materials_source_url = 'https://engineering.lehigh.edu/mse/undergraduate/mse-bs',
  aerospace_engineering = 'Partial',
  aerospace_program = 'Aerospace Engineering Minor',
  aerospace_notes = 'Lehigh''s aerospace page describes a minor only, not a major.',
  aerospace_source_url = 'https://engineering.lehigh.edu/academics/undergraduate/minors/aerospace-engineering',
  tracked_programs = case
    when tracked_programs is null or tracked_programs = '[]'::jsonb
      then '["Mechanical engineering","Material sciences","Aerospace engineering"]'::jsonb
    when tracked_programs @> '["Aerospace engineering"]'::jsonb
      then tracked_programs
    else tracked_programs || '["Aerospace engineering"]'::jsonb
  end,
  updated_at = now()
where name = 'Lehigh University';

update college.schools set
  materials = 'Yes',
  materials_offering = 'Standalone undergraduate',
  materials_program = 'Materials Science and Engineering (BSE)',
  materials_source_url = 'https://catalog.uconn.edu/undergraduate/engineering/materials-science-engineering-bse/',
  aerospace_engineering = 'Partial',
  aerospace_program = 'Aerospace concentration within Mechanical Engineering',
  aerospace_notes = 'The department is named Mechanical, Aerospace, and Manufacturing Engineering, but aerospace is a concentration only; it appears on the transcript.',
  aerospace_source_url = 'https://mechanical-aerospace-manufacturing.engineering.uconn.edu/undergraduate/areas-of-concentration/',
  tracked_programs = case
    when tracked_programs is null or tracked_programs = '[]'::jsonb
      then '["Mechanical engineering","Material sciences","Aerospace engineering"]'::jsonb
    when tracked_programs @> '["Aerospace engineering"]'::jsonb
      then tracked_programs
    else tracked_programs || '["Aerospace engineering"]'::jsonb
  end,
  updated_at = now()
where name = 'University of Connecticut (UConn)';

update college.schools set
  materials = 'Yes',
  materials_offering = 'Standalone undergraduate',
  materials_program = 'Bachelor of Materials Science and Engineering (BMSE)',
  materials_source_url = 'https://mseg.udel.edu/students/undergraduate/',
  aerospace_engineering = 'Partial',
  aerospace_program = 'Aerospace Engineering concentration within Mechanical Engineering',
  aerospace_notes = 'Aerospace is a concentration inside the Bachelor of Mechanical Engineering.',
  aerospace_source_url = 'https://catalog.udel.edu/preview_program.php?catoid=94&poid=92799',
  tracked_programs = case
    when tracked_programs is null or tracked_programs = '[]'::jsonb
      then '["Mechanical engineering","Material sciences","Aerospace engineering"]'::jsonb
    when tracked_programs @> '["Aerospace engineering"]'::jsonb
      then tracked_programs
    else tracked_programs || '["Aerospace engineering"]'::jsonb
  end,
  updated_at = now()
where name = 'University of Delaware';

update college.schools set
  materials = 'Yes',
  materials_offering = 'Standalone undergraduate',
  materials_program = 'Materials Science and Engineering (BSMSE)',
  materials_source_url = 'https://catalog.drexel.edu/majors/',
  aerospace_engineering = 'Partial',
  aerospace_program = 'Aerospace area of interest within Mechanical Engineering and Mechanics',
  aerospace_notes = 'Aerospace is a technical-elective track inside the Mechanical Engineering major; there is no aerospace major.',
  aerospace_source_url = 'https://drexel.edu/engineering/academics/departments/mechanical-engineering/resources/current-undergraduate-students/bs-mechanical-engineering/areas-of-interest/',
  tracked_programs = case
    when tracked_programs is null or tracked_programs = '[]'::jsonb
      then '["Mechanical engineering","Material sciences","Aerospace engineering"]'::jsonb
    when tracked_programs @> '["Aerospace engineering"]'::jsonb
      then tracked_programs
    else tracked_programs || '["Aerospace engineering"]'::jsonb
  end,
  updated_at = now()
where name = 'Drexel University';

update college.schools set
  materials = 'Yes',
  materials_offering = 'Standalone undergraduate',
  materials_program = 'Materials Engineering (BS)',
  materials_source_url = 'https://catalog.iastate.edu/collegeofengineering/materialsengineering/',
  aerospace_engineering = 'Yes',
  aerospace_program = 'BS in Aerospace Engineering',
  aerospace_notes = 'Offered by its own Department of Aerospace Engineering.',
  aerospace_source_url = 'https://catalog.iastate.edu/collegeofengineering/aerospaceengineering/',
  tracked_programs = case
    when tracked_programs is null or tracked_programs = '[]'::jsonb
      then '["Mechanical engineering","Material sciences","Aerospace engineering"]'::jsonb
    when tracked_programs @> '["Aerospace engineering"]'::jsonb
      then tracked_programs
    else tracked_programs || '["Aerospace engineering"]'::jsonb
  end,
  updated_at = now()
where name = 'Iowa State University';

update college.schools set
  materials = 'Yes',
  materials_offering = 'Standalone undergraduate',
  materials_program = 'Materials Science and Engineering (BS)',
  materials_source_url = 'https://www.clemson.edu/cecas/academics/degrees.html',
  aerospace_engineering = 'No',
  aerospace_program = '',
  aerospace_notes = 'No aerospace engineering major, concentration or minor; the Aerospace Studies minor is Air Force ROTC, not engineering.',
  aerospace_source_url = 'https://www.clemson.edu/cecas/academics/degrees.html',
  tracked_programs = case
    when tracked_programs is null or tracked_programs = '[]'::jsonb
      then '["Mechanical engineering","Material sciences","Aerospace engineering"]'::jsonb
    when tracked_programs @> '["Aerospace engineering"]'::jsonb
      then tracked_programs
    else tracked_programs || '["Aerospace engineering"]'::jsonb
  end,
  updated_at = now()
where name = 'Clemson University';

update college.schools set
  materials = 'Yes',
  materials_offering = 'Standalone undergraduate',
  materials_program = 'Materials Science and Engineering (BS)',
  materials_source_url = 'https://tickle.utk.edu/academics/undergraduate-programs/materials-science-and-engineering-bsmse/',
  aerospace_engineering = 'Yes',
  aerospace_program = 'BS in Aerospace Engineering',
  aerospace_notes = 'Offered by the Mechanical and Aerospace Engineering department; entry to upper-division courses is GPA-based.',
  aerospace_source_url = 'https://tickle.utk.edu/mae/academics/undergrad-studies/aerospace-engineering-bs/',
  tracked_programs = case
    when tracked_programs is null or tracked_programs = '[]'::jsonb
      then '["Mechanical engineering","Material sciences","Aerospace engineering"]'::jsonb
    when tracked_programs @> '["Aerospace engineering"]'::jsonb
      then tracked_programs
    else tracked_programs || '["Aerospace engineering"]'::jsonb
  end,
  updated_at = now()
where name = 'University of Tennessee, Knoxville';

update college.schools set
  materials = 'Yes',
  materials_offering = 'Standalone undergraduate',
  materials_program = 'Materials Science and Engineering (BS)',
  materials_source_url = 'https://www.mtu.edu/materials/undergraduate/degree/',
  aerospace_engineering = 'Yes',
  aerospace_program = 'BS in Aerospace Engineering',
  aerospace_notes = 'New major; the first class enrolled in 2025.',
  aerospace_source_url = 'https://www.mtu.edu/mechanical-aerospace/undergraduate/ae/',
  tracked_programs = case
    when tracked_programs is null or tracked_programs = '[]'::jsonb
      then '["Mechanical engineering","Material sciences","Aerospace engineering"]'::jsonb
    when tracked_programs @> '["Aerospace engineering"]'::jsonb
      then tracked_programs
    else tracked_programs || '["Aerospace engineering"]'::jsonb
  end,
  updated_at = now()
where name = 'Michigan Technological University (Michigan Tech)';

update college.schools set
  materials = 'Yes',
  materials_offering = 'Standalone undergraduate',
  materials_program = 'Materials Engineering (BS)',
  materials_source_url = 'https://catalog.njit.edu/undergraduate/newark-college-engineering/chemical-materials-engineering/cme-bs/',
  aerospace_engineering = 'No',
  aerospace_program = '',
  aerospace_notes = 'No aerospace engineering option; the Leadership and Aerospace Studies minor is ROTC, not engineering.',
  aerospace_source_url = 'https://catalog.njit.edu/undergraduate/newark-college-engineering/mechanical-industrial/mechanical-engineering-bs/',
  tracked_programs = case
    when tracked_programs is null or tracked_programs = '[]'::jsonb
      then '["Mechanical engineering","Material sciences","Aerospace engineering"]'::jsonb
    when tracked_programs @> '["Aerospace engineering"]'::jsonb
      then tracked_programs
    else tracked_programs || '["Aerospace engineering"]'::jsonb
  end,
  updated_at = now()
where name = 'New Jersey Institute of Technology (NJIT)';

update college.schools set
  materials = 'Partial',
  materials_offering = 'Concentration within Mechanical Engineering, plus minor',
  materials_program = 'Materials Science and Engineering concentration within Mechanical Engineering; Materials Engineering Minor',
  materials_source_url = 'https://wpi.cleancatalog.net/mechanical-and-materials-engineering',
  aerospace_engineering = 'Yes',
  aerospace_program = 'BS in Aerospace Engineering',
  aerospace_notes = 'Offered by the Aerospace Engineering department.',
  aerospace_source_url = 'https://wpi.cleancatalog.net/aerospace-engineering/aerospace-engineering-major',
  tracked_programs = case
    when tracked_programs is null or tracked_programs = '[]'::jsonb
      then '["Mechanical engineering","Material sciences","Aerospace engineering"]'::jsonb
    when tracked_programs @> '["Aerospace engineering"]'::jsonb
      then tracked_programs
    else tracked_programs || '["Aerospace engineering"]'::jsonb
  end,
  updated_at = now()
where name = 'Worcester Polytechnic Institute (WPI)';

update college.schools set
  materials = 'Partial',
  materials_offering = 'Minor only',
  materials_program = 'Materials Science and Engineering Minor',
  materials_source_url = 'https://www.stevens.edu/school-engineering-science/departments/chemical-engineering-materials-science/undergraduate-studies',
  aerospace_engineering = 'Yes',
  aerospace_program = 'Bachelor''s in Aerospace Engineering (new, starts Fall 2027)',
  aerospace_notes = 'New major starting Fall 2027, so it will be running when Kyle enrolls in Fall 2028; an aerospace concentration in Mechanical Engineering also exists.',
  aerospace_source_url = 'https://www.stevens.edu/school-engineering-science/departments/mechanical-engineering/undergraduate-studies',
  tracked_programs = case
    when tracked_programs is null or tracked_programs = '[]'::jsonb
      then '["Mechanical engineering","Material sciences","Aerospace engineering"]'::jsonb
    when tracked_programs @> '["Aerospace engineering"]'::jsonb
      then tracked_programs
    else tracked_programs || '["Aerospace engineering"]'::jsonb
  end,
  updated_at = now()
where name = 'Stevens Institute of Technology';

update college.schools set
  materials = 'Partial',
  materials_offering = 'Minor only',
  materials_program = 'Materials Science and Engineering Minor',
  materials_source_url = 'https://catalog.rose-hulman.edu/catalog/minors-certificates/materials-scienceengineering-minor/',
  aerospace_engineering = 'Partial',
  aerospace_program = 'Aerospace Engineering area of concentration within Mechanical Engineering',
  aerospace_notes = 'Aerospace is a concentration inside the Mechanical Engineering major.',
  aerospace_source_url = 'https://www.rose-hulman.edu/academics/academic-departments/mechanical-engineering/majors-and-minors.html',
  tracked_programs = case
    when tracked_programs is null or tracked_programs = '[]'::jsonb
      then '["Mechanical engineering","Material sciences","Aerospace engineering"]'::jsonb
    when tracked_programs @> '["Aerospace engineering"]'::jsonb
      then tracked_programs
    else tracked_programs || '["Aerospace engineering"]'::jsonb
  end,
  updated_at = now()
where name = 'Rose-Hulman Institute of Technology';

