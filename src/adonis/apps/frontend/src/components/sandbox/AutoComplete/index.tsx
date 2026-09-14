import { useEffect, useState } from "react";
import { useDebounce } from "../../../hooks/useDebounce";
import styled from "@emotion/styled";

type Product = {
  title: string;
  description: string;
  brand: string;
  category: string;
  id: number;
  images: string[];
  price: number;
}

type ProductResponse = {
  products: Product[];
};

const Wrapper = styled.div`
  display: inline-block;
  position: relative;
`;

const Suggestions = styled.div`
  display: absolute;
  width: 100%;
  border: 1px solid black;
`;

const API = 'https://dummyjson.com/product';

const fetchProducts = async () => {
  try {
    const response = await fetch(API);
    if (!response.ok) {
      console.log('Error: ', response.status);
      return [];
    }

    const json = await response.json() as ProductResponse;
    return json.products;
  } catch (e) {
    console.log(e);
    return [];
  }
};

// const debounce = (callback, timeout = 1000) => {
//   let timeoutId = null;

//   return (...args) => {
//     clearTimeout(timeoutId);
//     timeoutId = setTimeout(() => {
//       callback(...args);
//     }, timeout);
//   };
// };



export const AutoComplete = () => {
  const [input, setInput] = useState('');
  const [products, setProducts] = useState<Product[]>([]);
  const [suggestions, setSuggestions] = useState<Product[]>([]);
  const [selectedSuggestion, setSelectedSuggestion] = useState<Product>();

  useEffect(() => {
    const fetchData = async () => {
      const data = await fetchProducts();
      setProducts(data);
    };

    fetchData();
  }, []);

  const debouncedFilterSuggestions = useDebounce((text: string) => {
    let trimmed = text.trim();
    if (trimmed === '') {
      setSuggestions([]);
      return;
    }
    setSuggestions(products.filter(product => product.title.indexOf(text) >= 0));
  });

  const handleInputChange = (e) => {
    const text = e.target.value;
    setInput(text);
    debouncedFilterSuggestions(text);
  };

  const handleSuggestionClick = (suggestion: Product) => {
    setSelectedSuggestion(suggestion);
    setSuggestions([]);
    setInput('');
  };

  return (
    <>
      <form>
        <Wrapper>
          <input type="text" value={input} onChange={handleInputChange} />
          {suggestions.length > 0 && (<Suggestions>
            {suggestions.map(suggestion => (
              <div key={suggestion.id} onClick={() => handleSuggestionClick(suggestion)}>{suggestion.title}</div>
            ))}
          </Suggestions>)}
        </Wrapper>
      </form>
      <pre>{JSON.stringify(selectedSuggestion, null, 2)}</pre>
    </>
  )
};