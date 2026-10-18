import { describe,it,expect } from 'vitest';
import { rowSchema, HEADERS, parseCsv } from '../src/modules/imports/csv.js';
import { fieldIssues, referenceMessages, domainMessages } from '../src/modules/imports/messages.js';
const valid={employee_code:'EMP1',name:'Example',email:'person@example.test',country_code:'US',department_code:'ENG',designation_code:'ENG_1',hire_date:'2024-01-01',annual_base_salary:'50000.00',currency_code:'USD',effective_date:'2024-01-01'};
function errors(values:Record<string,string>){const parsed=rowSchema.safeParse(values);if(parsed.success)throw new Error('Expected invalid fixture');return fieldIssues(parsed.error.issues,values);}
describe('friendly CSV validation',()=>{
  it.each(HEADERS)('explains missing %s while preserving the field and code',field=>{
    const issues=errors({...valid,[field]:''});expect(issues).toHaveLength(1);expect(issues[0]).toMatchObject({field,code:field==='annual_base_salary'?'INVALID_AMOUNT':'INVALID_FIELD'});expect(issues[0]!.message).toContain('required');
  });
  it.each(['hire_date','effective_date'])('distinguishes %s format from calendar errors',field=>{
    expect(errors({...valid,[field]:'10/18/2026'})[0]!.message).toContain('YYYY-MM-DD');
    const invalid=errors({...valid,[field]:'2026-02-30'});expect(invalid).toHaveLength(1);expect(invalid[0]!.message).toContain('does not exist');
  });
  it.each([['employee_code','bad id'],['name','x'.repeat(151)],['email','invalid'],['country_code','USA'],['department_code','bad code'],['designation_code','bad code'],['currency_code','US'],['annual_base_salary','-1'],['annual_base_salary','1.234'],['annual_base_salary','10000000000000']])('explains invalid %s without exposing validators', (field,value)=>{
    const issues=errors({...valid,[field]:value});expect(issues[0]!.field).toBe(field);expect(issues[0]!.message).not.toMatch(/regex|pattern|Zod|Prisma|\^|\$/);expect(issues[0]!.message.length).toBeGreaterThan(20);
  });
  it('retains separate errors for multiple invalid fields',()=>expect(errors({...valid,email:'bad',hire_date:'bad',annual_base_salary:'-2'}).map(e=>e.field)).toEqual(['email','hire_date','annual_base_salary']));
  it.each(Object.entries(referenceMessages))('explains unsupported %s',(_field,message)=>{expect(message).toMatch(/Use/);expect(message).not.toContain('catalog');});
  it.each(Object.entries(domainMessages))('provides actionable domain message %s',(_code,message)=>{expect(message.length).toBeGreaterThan(40);expect(message).not.toMatch(/Prisma|Zod|SQL/);});
  it('makes structural and empty-file errors actionable',()=>{
    expect(()=>parseCsv(Buffer.from('wrong\nvalue'))).toThrow('template');
    expect(()=>parseCsv(Buffer.from(HEADERS.join(',')))).toThrow('Add at least one row');
    expect(()=>parseCsv(Buffer.from(HEADERS.join(',')+'\n"unclosed'))).toThrow('double quotes');
  });
});
