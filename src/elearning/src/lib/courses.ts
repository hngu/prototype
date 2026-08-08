import { getCollection, type CollectionEntry } from 'astro:content'

export type Course = CollectionEntry<'courses'>
export type Lesson = CollectionEntry<'lessons'>

/** Drafts are visible while authoring but never built into a production site,
 *  so they can't be crawled or land in the sitemap. */
const showDrafts = import.meta.env.DEV

/** Lesson ids look like `typescript-fundamentals/type-inference`; the route
 *  param is only the trailing segment. */
export const lessonSlug = (lesson: Lesson): string => lesson.id.split('/').pop()!

export async function getPublishedCourses(): Promise<Course[]> {
  const courses = await getCollection('courses', ({ data }) => showDrafts || !data.draft)
  return courses.sort(
    (a, b) => a.data.order - b.data.order || a.data.title.localeCompare(b.data.title),
  )
}

/** Lessons for one course, in authoritative `order` sequence. */
export async function getCourseLessons(courseId: string): Promise<Lesson[]> {
  const lessons = await getCollection(
    'lessons',
    ({ data }) => data.course.id === courseId && (showDrafts || !data.draft),
  )
  return lessons.sort((a, b) => a.data.order - b.data.order)
}

export interface Neighbours {
  prev: Lesson | undefined
  next: Lesson | undefined
}

/** Prev/next falls straight out of position in the sorted array — no extra
 *  frontmatter and no linked list to keep consistent. */
export function getNeighbours(lessons: Lesson[], index: number): Neighbours {
  return { prev: lessons[index - 1], next: lessons[index + 1] }
}

export const totalDuration = (lessons: Lesson[]): number =>
  lessons.reduce((sum, lesson) => sum + lesson.data.duration, 0)

export function formatDuration(minutes: number): string {
  if (minutes < 60) return `${minutes} min`
  const hours = Math.floor(minutes / 60)
  const rest = minutes % 60
  return rest === 0 ? `${hours} hr` : `${hours} hr ${rest} min`
}

export interface CourseSummary {
  course: Course
  lessons: Lesson[]
  lessonCount: number
  duration: number
}

/** Courses with their lessons already resolved — used by the courses index and
 *  the landing page so neither has to re-query per card. */
export async function getCourseSummaries(): Promise<CourseSummary[]> {
  const courses = await getPublishedCourses()
  return Promise.all(
    courses.map(async (course) => {
      const lessons = await getCourseLessons(course.id)
      return {
        course,
        lessons,
        lessonCount: lessons.length,
        duration: totalDuration(lessons),
      }
    }),
  )
}
