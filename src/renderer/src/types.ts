export interface Comic {
  id: number
  name: string
  author: string
  image_path: string | null
  directory: string
  favorite: number
  is_hidden: number
}

export interface Volume {
  id: number
  comic_id: number
  number: number
  directory: string
  file: string | null
}

export interface Chapter {
  id: number
  volume_id: number
  number: number
  type: 'chapter' | 'extra'
  file: string
}

export interface VolumeWithChapters extends Volume {
  chapters: Chapter[]
}

export interface ComicWithVolumes extends Comic {
  volumes: VolumeWithChapters[]
}

export interface ComicsPage {
  comics: Comic[]
  total: number
  page: number
  pageSize: number
}
