import { useCallback, useEffect, useRef, useState } from "react";
import type { Product, ProductResponse } from "../../../api/dummyProduct";
import styled from "@emotion/styled";

/**
 * hard because there was react strict mode that caused the component to load
 * the component twice fetching it twice.
 *
 * The main thing to understand is that you want to first:
 * 1. Create a container
 * 1. Fetch items for the container
 * 1. Render the items in the container
 * 1. Show extra item row which, when intersected, will load more
 * 1. The tricky parts are understanding intersection observer
 * 1. Add useCallback for fetching data and keeping track if you have more
 * 1. Do not show the extra row unless you have more, which means hasMore = false on first component render
 * 1. This is because if we try to load on render, we have zero rows but the extra row which triggers intersection!
 * 1. Also understand that you have to disconnect the intersection
 *
 */
const LIMIT = 20;
const INCREMENT = 20;
const fetchData = async (skip) => {
  const response = await fetch(`https://dummyjson.com/products?limit=${LIMIT}&skip=${skip}`);
  if (!response.ok) {
    return null;
  }

  return await response.json() as ProductResponse;
};

const Container = styled.ul`
  width: 600px;
  height: 300px;
  border: 1px solid black;
  overflow: scroll;
`;

const Row = styled.li`
  height: 50px;
`;

export const InfiniteScroll = () => {
  const [rows, setRows] = useState<Product[]>([]);
  const containerRef = useRef(null);
  const triggerRef = useRef(null);
  const skipRef = useRef(0);
  const [hasMore, setHasMore] = useState(false);

  const handleFetchProducts = useCallback(async () => {
    const productResponse = await fetchData(skipRef.current);
    if (productResponse.skip + productResponse.limit >= productResponse.total) {
      setHasMore(false);
    } else {
      skipRef.current += INCREMENT;
      setHasMore(true);
    }
    setRows((prevRows) => [...prevRows, ...(productResponse?.products || [])]);
  }, []);

  useEffect(() => {
    const fetchProducts = async () => {
      const productResponse = await fetchData(skipRef.current);
      setRows(productResponse.products);
      skipRef.current += INCREMENT;
      setHasMore(true);
    };
    fetchProducts();
  }, []);

  useEffect(() => {
    if (!containerRef.current || !triggerRef.current || !hasMore) {
      return;
    }

    const options = {
      root: containerRef.current,
      rootMargin: "0px",
      scrollMargin: "0px",
      threshold: 0.3,
    };

    const observer = new IntersectionObserver((entries) => {
      if (!entries[0].isIntersecting) {
        return;
      }
      handleFetchProducts();
    }, options);

    observer.observe(triggerRef.current);

    // need to disconnect when skip or loading changes
    return () => observer.disconnect();
  }, [hasMore, handleFetchProducts]);

  return (
    <>
      <Container ref={containerRef}>
        {rows.map(row => (
          <Row key={row.id}>{row.title} {row.id}</Row>
        ))}
        {hasMore && (<Row key="trigger" ref={triggerRef}>Load more</Row>)}
      </Container>
    </>
  )
};