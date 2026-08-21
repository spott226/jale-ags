import { describe,expect,it } from "vitest";
import { candidateLimit,opportunityScore } from "../lib/config";

describe("candidateLimit",()=>{
  it.each([[1,5],[2,6],[3,8],[4,8],[5,10],[6,11],[10,18],[11,17],[20,30]])("%i trabajadores permiten %i interesados",(workers,expected)=>expect(candidateLimit(workers)).toBe(expected));
  it("normaliza valores menores a uno",()=>expect(candidateLimit(0)).toBe(5));
});
describe("opportunityScore",()=>{
  const base={completedTotal:1,daysSinceCompleted:14,recentRejections:0,attendanceRate:80,rating:4,recentCompleted:0,activeApplications:0,noShows:0,conflictingSelection:false,daysSinceActivity:1};
  it("es determinístico y acotado",()=>{expect(opportunityScore(base)).toBe(opportunityScore(base));expect(opportunityScore({...base,noShows:99})).toBe(0)});
  it("prioriza a una persona nueva",()=>expect(opportunityScore({...base,completedTotal:0})).toBeGreaterThan(opportunityScore(base)));
  it("penaliza no-shows y postulaciones activas",()=>expect(opportunityScore({...base,noShows:1,activeApplications:3})).toBeLessThan(opportunityScore(base)));
  it("reconoce un regreso después de inactividad",()=>expect(opportunityScore({...base,daysSinceActivity:90})).toBeGreaterThan(opportunityScore(base)));
});
