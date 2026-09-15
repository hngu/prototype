export type Product = {
  title: string
  description: string
  brand: string
  category: string
  id: number
  images: string[]
  price: number
}

export type ProductResponse = {
  products: Product[]
  total: number
  skip: number
  limit: number
}
