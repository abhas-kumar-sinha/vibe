import { useState, useEffect } from "react";

const useScroll = (threshold = 10) => {
  const [isScrolled, setIsScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > threshold);
    };

    window.addEventListener("scroll", handleScroll);
    handleScroll();

    return () => removeEventListener("scroll", handleScroll);
  }, [threshold]);

  return isScrolled;
};

export default useScroll;
