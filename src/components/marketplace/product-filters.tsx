"use client";

import { useState, useEffect, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Slider } from "@/components/ui/slider";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { 
  Search, Filter, X, ChevronDown, ChevronUp, 
  MapPin, DollarSign, Package, Tag 
} from "lucide-react";
import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";

export interface ProductFilters {
  search: string;
  category: string;
  minPrice: number;
  maxPrice: number;
  location: string;
  sortBy: string;
  onlyFeatured: boolean;
}

interface ProductFiltersProps {
  filters: ProductFilters;
  onFiltersChange: (filters: ProductFilters) => void;
  categories: string[];
  locations: string[];
  priceRange: { min: number; max: number };
  totalProducts: number;
  isLoading?: boolean;
}

const sortOptions = [
  { value: "newest", label: "Más recientes" },
  { value: "oldest", label: "Más antiguos" },
  { value: "price_asc", label: "Precio: menor a mayor" },
  { value: "price_desc", label: "Precio: mayor a menor" },
  { value: "featured", label: "Destacados primero" },
  { value: "alphabetical", label: "Alfabético A-Z" },
];

export default function ProductFilters({
  filters,
  onFiltersChange,
  categories,
  locations,
  priceRange,
  totalProducts,
  isLoading = false
}: ProductFiltersProps) {
  const [isFiltersOpen, setIsFiltersOpen] = useState(false);
  const [localPriceRange, setLocalPriceRange] = useState([filters.minPrice, filters.maxPrice]);
  const [locationQuery, setLocationQuery] = useState(filters.location && filters.location !== "all" ? filters.location : "");
  const [locationResults, setLocationResults] = useState<string[]>([]);
  const supabase = useMemo(() => createClient(), []);

  // Actualizar rango de precios local cuando cambian los filtros
  useEffect(() => {
    setLocalPriceRange([filters.minPrice, filters.maxPrice]);
  }, [filters.minPrice, filters.maxPrice]);

  // Sincronizar query de ubicación cuando cambia el filtro externo
  useEffect(() => {
    if (!filters.location || filters.location === "all") {
      setLocationQuery("");
    } else {
      setLocationQuery(filters.location);
    }
  }, [filters.location]);

  const updateFilter = (key: keyof ProductFilters, value: any) => {
    onFiltersChange({
      ...filters,
      [key]: value
    });
  };

  const handlePriceRangeChange = (values: number[]) => {
    setLocalPriceRange(values);
  };

  const handlePriceRangeCommit = (values: number[]) => {
    onFiltersChange({
      ...filters,
      minPrice: values[0],
      maxPrice: values[1]
    });
  };

  // Búsqueda con debounce de ubicaciones distintas en products.location
  useEffect(() => {
    let active = true;
    const run = async () => {
      const q = locationQuery.trim();
      if (q.length < 1) {
        if (active) setLocationResults([]);
        return;
      }
      // pequeño debounce
      await new Promise((r) => setTimeout(r, 250));
      if (!active) return;
      const { data, error } = await supabase
        .from('products')
        .select('location')
        .eq('published', true)
        .not('location', 'is', null)
        .neq('location', '')
        .ilike('location', `%${q}%`)
        .order('location', { ascending: true })
        .limit(50);
      if (!active) return;
      if (error) {
        console.error('Error fetching locations:', error);
        setLocationResults([]);
        return;
      }
      const list = Array.from(new Set((data || []).map((r: any) => r.location as string))).slice(0, 10);
      setLocationResults(list);
    };
    run();
    return () => { active = false; };
  }, [locationQuery, supabase]);

  const clearFilters = () => {
    onFiltersChange({
      search: "",
      category: "all",
      minPrice: priceRange.min,
      maxPrice: priceRange.max,
      location: "all",
      sortBy: "newest",
      onlyFeatured: false
    });
    setLocalPriceRange([priceRange.min, priceRange.max]);
  };

  const getActiveFiltersCount = () => {
    let count = 0;
    if (filters.search) count++;
    if (filters.category && filters.category !== "all") count++;
    if (filters.location && filters.location !== "all") count++;
    if (filters.onlyFeatured) count++;
    if (filters.minPrice > priceRange.min || filters.maxPrice < priceRange.max) count++;
    return count;
  };

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('es-AR', {
      style: 'currency',
      currency: 'ARS',
      minimumFractionDigits: 0,
    }).format(price);
  };

  return (
    <div className="space-y-3">
      {/* Barra de búsqueda y ordenamiento */}
      <div className="flex flex-col sm:flex-row gap-2">
        {/* Búsqueda */}
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            placeholder="Buscar productos..."
            value={filters.search}
            onChange={(e) => updateFilter("search", e.target.value)}
            className="pl-10 h-10"
          />
        </div>

        {/* Ordenamiento */}
        <div className="sm:w-56">
          <Select value={filters.sortBy} onValueChange={(value) => updateFilter("sortBy", value)}>
            <SelectTrigger className="h-10">
              <SelectValue placeholder="Ordenar por" />
            </SelectTrigger>
            <SelectContent>
              {sortOptions.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Botón de filtros (desktop y móvil) */}
        <Button
          variant="outline"
          onClick={() => setIsFiltersOpen(!isFiltersOpen)}
          className="h-10 px-3"
        >
          <Filter className="h-4 w-4 mr-2" />
          Filtros
          {getActiveFiltersCount() > 0 && (
            <Badge className="ml-2 bg-orange-500">
              {getActiveFiltersCount()}
            </Badge>
          )}
        </Button>
      </div>

      {/* Filtros avanzados */}
      <div className={cn(
        "space-y-2",
        isFiltersOpen ? "block" : "hidden"
      )}>
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base flex items-center">
                <Filter className="h-4 w-4 mr-2" />
                Filtros
                {getActiveFiltersCount() > 0 && (
                  <Badge className="ml-2 bg-orange-500">
                    {getActiveFiltersCount()}
                  </Badge>
                )}
              </CardTitle>
              {getActiveFiltersCount() > 0 && (
                <Button variant="ghost" size="sm" onClick={clearFilters}>
                  <X className="h-4 w-4 mr-1" />
                  Limpiar
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
              {/* Categoría */}
              <div className="space-y-2">
                <Label className="flex items-center text-sm font-medium">
                  <Tag className="h-4 w-4 mr-2" />
                  Categoría
                </Label>
                <Select value={filters.category} onValueChange={(value) => updateFilter("category", value)}>
                  <SelectTrigger className="h-9">
                    <SelectValue placeholder="Todas las categorías" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todas las categorías</SelectItem>
                    {categories.map((category) => (
                      <SelectItem key={category} value={category}>
                        {category}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Ubicación */}
              <div className="space-y-2">
                <Label className="flex items-center text-sm font-medium">
                  <MapPin className="h-4 w-4 mr-2" />
                  Ubicación
                </Label>
                <div className="relative">
                  <Input
                    placeholder="Buscar ubicación..."
                    value={locationQuery}
                    onChange={(e) => setLocationQuery(e.target.value)}
                    className="pr-10 h-9"
                  />
                  {/* Dropdown de sugerencias */}
                  {(locationQuery.length >= 1) && (
                    <div className="absolute z-20 mt-1 w-full rounded-md border bg-white shadow max-h-56 overflow-auto">
                      <button
                        type="button"
                        className="w-full text-left px-2 py-1.5 hover:bg-orange-50 text-sm"
                        onClick={() => {
                          updateFilter("location", "all");
                          setLocationQuery("");
                        }}
                      >
                        Todas las ubicaciones
                      </button>
                      {locationResults.length === 0 ? (
                        <div className="px-2 py-1.5 text-sm text-gray-500">No se encontraron ubicaciones</div>
                      ) : (
                        locationResults.map((loc) => (
                          <button
                            key={loc}
                            type="button"
                            className="w-full text-left px-2 py-1.5 hover:bg-orange-50 text-sm"
                            onClick={() => {
                              updateFilter("location", loc);
                              setLocationQuery(loc);
                            }}
                          >
                            {loc}
                          </button>
                        ))
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* Rango de precios */}
              <div className="space-y-2 md:col-span-2">
                <Label className="flex items-center text-sm font-medium">
                  <DollarSign className="h-4 w-4 mr-2" />
                  Rango de precios
                </Label>
                <div className="px-1">
                  <Slider
                    value={localPriceRange}
                    onValueChange={handlePriceRangeChange}
                    onValueCommit={handlePriceRangeCommit}
                    min={priceRange.min}
                    max={priceRange.max}
                    step={1000}
                    className="w-full"
                  />
                  <div className="flex justify-between text-xs text-gray-500 mt-1">
                    <span>{formatPrice(localPriceRange[0])}</span>
                    <span>{formatPrice(localPriceRange[1])}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Filtros adicionales */}
            <div className="pt-2">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="featured"
                  checked={filters.onlyFeatured}
                  onCheckedChange={(checked) => updateFilter("onlyFeatured", checked)}
                />
                <Label htmlFor="featured" className="text-sm font-medium cursor-pointer">
                  Solo productos destacados
                </Label>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Resumen de resultados */}
      <div className="flex items-center justify-between text-sm text-gray-600">
        <span>
          {isLoading ? (
            "Cargando productos..."
          ) : (
            `${totalProducts} producto${totalProducts !== 1 ? 's' : ''} encontrado${totalProducts !== 1 ? 's' : ''}`
          )}
        </span>
        
        {getActiveFiltersCount() > 0 && (
          <div className="flex items-center gap-2">
            <span>Filtros activos:</span>
            <div className="flex gap-1">
              {filters.search && (
                <Badge variant="secondary" className="text-xs">
                  &ldquo;{filters.search}&rdquo;
                  <button
                    onClick={() => updateFilter("search", "")}
                    className="ml-1 hover:text-red-500"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              )}
              {filters.category && filters.category !== "all" && (
                <Badge variant="secondary" className="text-xs">
                  {filters.category}
                  <button
                    onClick={() => updateFilter("category", "all")}
                    className="ml-1 hover:text-red-500"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              )}
              {filters.location && filters.location !== "all" && (
                <Badge variant="secondary" className="text-xs">
                  {filters.location}
                  <button
                    onClick={() => updateFilter("location", "all")}
                    className="ml-1 hover:text-red-500"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              )}
              {filters.onlyFeatured && (
                <Badge variant="secondary" className="text-xs">
                  Destacados
                  <button
                    onClick={() => updateFilter("onlyFeatured", false)}
                    className="ml-1 hover:text-red-500"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
